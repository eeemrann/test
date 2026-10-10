import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  ilike,
  isNotNull,
  lt,
  lte,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseService } from '../database/database.service.js';
import {
  notifications,
  taskActivities,
  tasks,
  teams,
  users,
  type Notification,
  type Task,
} from '../database/schema.js';
import { RealtimeNotificationsService } from '../realtime/realtime-notifications.service.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { TaskActivityQueryDto } from './dto/task-activity-query.dto.js';
import type { ReassignTaskDto } from './dto/reassign-task.dto.js';
import type {
  TaskQueryDto,
  TaskSortField,
  TaskSortOrder,
} from './dto/task-query.dto.js';
import type { TaskSummaryQueryDto } from './dto/task-summary-query.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import type { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';
import type {
  PaginatedResponse,
  PublicTaskTeam,
  PublicTaskUser,
  TaskActivityResponse,
  TaskResponse,
  TaskSummaryResponse,
} from './types/task.types.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const creatorAlias = alias(users, 'task_creator');
const assigneeAlias = alias(users, 'task_assignee');

type EditableTaskField = 'title' | 'description' | 'priority' | 'deadline';

type TaskEditResult = {
  task: Task;
  changed: boolean;
  notification?: Notification;
};

type TaskFilterQuery = {
  status?: TaskQueryDto['status'];
  priority?: TaskQueryDto['priority'];
  assignedToId?: string;
  createdById?: string;
  teamId?: string;
  search?: string;
  deadlineFrom?: string | null;
  deadlineTo?: string | null;
  overdue?: boolean;
};

type TaskActivityJoinedRow = {
  activityId: string;
  type: TaskActivityResponse['type'];
  metadata: unknown;
  createdAt: Date;
  actorId: string;
  actorFullName: string;
  actorEmail: string;
  actorRole: PublicTaskUser['role'];
  actorTeamId: string | null;
};

type TaskJoinedRow = {
  taskId: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  taskTeamId: string | null;
  deadline: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creatorId: string;
  creatorFullName: string;
  creatorEmail: string;
  creatorRole: PublicTaskUser['role'];
  creatorTeamId: string | null;
  assigneeId: string;
  assigneeFullName: string;
  assigneeEmail: string;
  assigneeRole: PublicTaskUser['role'];
  assigneeTeamId: string | null;
  teamId: string | null;
  teamName: string | null;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Optional()
    private readonly realtimeNotificationsService?: RealtimeNotificationsService,
  ) {}

  async createTask(
    dto: CreateTaskDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskResponse> {
    const assignee = await this.findAssignee(dto.assignedToId);
    const deadline = this.parseDeadline(dto.deadline);

    let createdResult: { task: Task; notification: Notification };

    try {
      createdResult = await this.databaseService.db.transaction(async (tx) => {
        const [task] = await tx
          .insert(tasks)
          .values({
            title: dto.title,
            description: dto.description ?? null,
            status: 'PENDING',
            priority: dto.priority ?? 'MEDIUM',
            createdById: currentUser.id,
            assignedToId: assignee.id,
            teamId: assignee.teamId,
            deadline,
          })
          .returning();

        if (!task) {
          throw new Error('Task insert returned no row');
        }

        await tx.insert(taskActivities).values([
          {
            taskId: task.id,
            actorUserId: currentUser.id,
            type: 'CREATED',
          },
          {
            taskId: task.id,
            actorUserId: currentUser.id,
            type: 'ASSIGNED',
          },
        ]);

        const [notification] = await tx.insert(notifications).values({
          recipientUserId: assignee.id,
          taskId: task.id,
          type: 'TASK_ASSIGNED',
          title: 'Task assigned',
          message: 'A new task has been assigned to you.',
        }).returning();

        if (!notification) {
          throw new Error('Notification insert returned no row');
        }

        return { task, notification };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Task operation failed');
    }

    await this.publishCommittedNotification(createdResult.notification);

    try {
      return await this.getTaskById(createdResult.task.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Task operation failed');
    }
  }

  async listTasks(
    query: TaskQueryDto,
  ): Promise<PaginatedResponse<TaskResponse>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const where = this.buildTaskFilters(query);

    try {
      const [countRows, taskRows] = await Promise.all([
        this.databaseService.db
          .select({ count: sql<number>`count(*)::int` })
          .from(tasks)
          .where(where),
        this.selectTaskRows(where, limit, (page - 1) * limit, query),
      ]);

      const total = Number(countRows[0]?.count ?? 0);
      return {
        data: taskRows.map((row) => this.toTaskResponse(row)),
        pagination: this.pagination(page, limit, total),
      };
    } catch {
      throw new InternalServerErrorException('Task operation failed');
    }
  }

  async listMyTasks(
    query: TaskQueryDto,
    currentUserId: string,
  ): Promise<PaginatedResponse<TaskResponse>> {
    if (query.assignedToId && query.assignedToId !== currentUserId) {
      throw new BadRequestException(
        'assignedToId cannot target another user on /tasks/my',
      );
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const where = this.buildTaskFilters(query, currentUserId);

    try {
      const [countRows, taskRows] = await Promise.all([
        this.databaseService.db
          .select({ count: sql<number>`count(*)::int` })
          .from(tasks)
          .where(where),
        this.selectTaskRows(where, limit, (page - 1) * limit, query),
      ]);

      const total = Number(countRows[0]?.count ?? 0);
      return {
        data: taskRows.map((row) => this.toTaskResponse(row)),
        pagination: this.pagination(page, limit, total),
      };
    } catch {
      throw new InternalServerErrorException('Task operation failed');
    }
  }

  async getTaskById(id: string): Promise<TaskResponse> {
    try {
      const [row] = await this.selectTaskRows(eq(tasks.id, id), 1, 0);

      if (!row) {
        throw new NotFoundException('Task not found');
      }

      return this.toTaskResponse(row);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Task operation failed');
    }
  }

  async listTaskActivities(
    taskId: string,
    query: TaskActivityQueryDto,
  ): Promise<PaginatedResponse<TaskActivityResponse>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    try {
      const [task] = await this.databaseService.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);

      if (!task) {
        throw new NotFoundException('Task not found');
      }

      const [countRows, activityRows] = await Promise.all([
        this.databaseService.db
          .select({ count: sql<number>`count(*)::int` })
          .from(taskActivities)
          .where(eq(taskActivities.taskId, taskId)),
        this.databaseService.db
          .select({
            activityId: taskActivities.id,
            type: taskActivities.type,
            metadata: taskActivities.metadata,
            createdAt: taskActivities.createdAt,
            actorId: users.id,
            actorFullName: users.fullName,
            actorEmail: users.email,
            actorRole: users.role,
            actorTeamId: users.teamId,
          })
          .from(taskActivities)
          .innerJoin(users, eq(taskActivities.actorUserId, users.id))
          .where(eq(taskActivities.taskId, taskId))
          .orderBy(desc(taskActivities.createdAt), desc(taskActivities.id))
          .limit(limit)
          .offset((page - 1) * limit),
      ]);

      const total = Number(countRows[0]?.count ?? 0);
      return {
        data: activityRows.map((row) => this.toTaskActivityResponse(row)),
        pagination: this.pagination(page, limit, total),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Task operation failed');
    }
  }

  async getTaskSummary(
    query: TaskSummaryQueryDto,
    currentUserId: string,
  ): Promise<TaskSummaryResponse> {
    const scope = query.scope ?? 'all';

    if (scope === 'mine' && query.assignedToId && query.assignedToId !== currentUserId) {
      throw new BadRequestException(
        'assignedToId cannot target another user in mine scope',
      );
    }

    const now = new Date();
    const where = this.buildTaskFilters(
      query,
      scope === 'mine' ? currentUserId : undefined,
      now,
    );

    try {
      const [row] = await this.databaseService.db
        .select({
          total: sql<number>`count(*)::int`,
          pending: sql<number>`count(*) filter (where ${tasks.status} = 'PENDING')::int`,
          working: sql<number>`count(*) filter (where ${tasks.status} = 'WORKING')::int`,
          done: sql<number>`count(*) filter (where ${tasks.status} = 'DONE')::int`,
          overdue: sql<number>`count(*) filter (where ${tasks.deadline} is not null and ${tasks.deadline} < ${now} and ${tasks.status} <> 'DONE')::int`,
        })
        .from(tasks)
        .where(where);

      return {
        total: Number(row?.total ?? 0),
        pending: Number(row?.pending ?? 0),
        working: Number(row?.working ?? 0),
        done: Number(row?.done ?? 0),
        overdue: Number(row?.overdue ?? 0),
      };
    } catch {
      throw new InternalServerErrorException('Task operation failed');
    }
  }

  async updateTaskStatus(
    id: string,
    dto: UpdateTaskStatusDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskResponse> {
    let result: TaskEditResult;

    try {
      result = await this.databaseService.db.transaction(async (tx) => {
        const [currentTask] = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.id, id))
          .for('update');

        if (!currentTask) {
          throw new NotFoundException('Task not found');
        }

        this.assertStatusPermission(currentTask, currentUser);

        if (currentTask.status === dto.status) {
          return { task: currentTask, changed: false };
        }

        if (!this.isAllowedStatusTransition(currentTask.status, dto.status, currentUser)) {
          throw new ConflictException('Invalid task status transition');
        }

        const changedAt = new Date();
        const completedAt = dto.status === 'DONE' ? changedAt : null;
        const [updatedTask] = await tx
          .update(tasks)
          .set({
            status: dto.status,
            completedAt,
            updatedAt: changedAt,
          })
          .where(eq(tasks.id, id))
          .returning();

        if (!updatedTask) {
          throw new ConflictException('Task changed concurrently');
        }

        await tx.insert(taskActivities).values({
          taskId: id,
          actorUserId: currentUser.id,
          type: 'STATUS_CHANGED',
          metadata: {
            previousStatus: currentTask.status,
            newStatus: dto.status,
            actorUserId: currentUser.id,
            changedAt: changedAt.toISOString(),
          },
        });

        let notification: Notification | undefined;
        if (currentTask.createdById !== currentUser.id) {
          [notification] = await tx.insert(notifications).values({
            recipientUserId: currentTask.createdById,
            taskId: id,
            type: 'TASK_STATUS_CHANGED',
            title: 'Task status changed',
            message: 'A task you created has changed status.',
          }).returning();
        }

        return { task: updatedTask, changed: true, notification };
      });
    } catch (error) {
      this.rethrowTaskMutationError(error);
    }

    await this.publishCommittedNotification(result.notification);
    return this.getTaskById(result.task.id);
  }

  async updateTask(
    id: string,
    dto: UpdateTaskDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskResponse> {
    if (!this.hasEditableField(dto)) {
      throw new BadRequestException(
        'At least one editable task field is required',
      );
    }

    let result: TaskEditResult;

    try {
      result = await this.databaseService.db.transaction(async (tx) => {
        const [currentTask] = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.id, id))
          .for('update');

        if (!currentTask) {
          throw new NotFoundException('Task not found');
        }

        this.assertEditPermission(currentTask, currentUser);

        const { values, metadata } = this.buildTaskEdits(currentTask, dto);

        if (Object.keys(values).length === 0) {
          return { task: currentTask, changed: false };
        }

        const changedAt = new Date();
        const [updatedTask] = await tx
          .update(tasks)
          .set({ ...values, updatedAt: changedAt })
          .where(eq(tasks.id, id))
          .returning();

        if (!updatedTask) {
          throw new ConflictException('Task changed concurrently');
        }

        await tx.insert(taskActivities).values({
          taskId: id,
          actorUserId: currentUser.id,
          type: 'UPDATED',
          metadata: {
            actorUserId: currentUser.id,
            changedAt: changedAt.toISOString(),
            changes: metadata,
          },
        });

        let notification: Notification | undefined;
        if (currentTask.assignedToId !== currentUser.id) {
          [notification] = await tx.insert(notifications).values({
            recipientUserId: currentTask.assignedToId,
            taskId: id,
            type: 'TASK_UPDATED',
            title: 'Task updated',
            message: 'A task assigned to you has been updated.',
          }).returning();
        }

        return { task: updatedTask, changed: true, notification };
      });
    } catch (error) {
      this.rethrowTaskMutationError(error);
    }

    await this.publishCommittedNotification(result.notification);
    return this.getTaskById(result.task.id);
  }

  async reassignTask(
    id: string,
    dto: ReassignTaskDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskResponse> {
    let result: TaskEditResult;

    try {
      result = await this.databaseService.db.transaction(async (tx) => {
        const [currentTask] = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.id, id))
          .for('update');

        if (!currentTask) {
          throw new NotFoundException('Task not found');
        }

        const userIds = [
          currentUser.id,
          currentTask.assignedToId,
          dto.assignedToId,
        ]
          .filter((userId, index, all) => all.indexOf(userId) === index)
          .sort();
        const lockedUsers = await tx
          .select({
            id: users.id,
            role: users.role,
            teamId: users.teamId,
            isActive: users.isActive,
          })
          .from(users)
          .where(inArray(users.id, userIds))
          .orderBy(asc(users.id))
          .for('update');

        const actor = lockedUsers.find((user) => user.id === currentUser.id);
        if (!actor || !actor.isActive) {
          throw new ForbiddenException('Reassignment is not permitted');
        }

        if (actor.role !== 'MANAGER' && actor.role !== 'ADMIN') {
          throw new ForbiddenException('Reassignment is not permitted');
        }

        const currentAssignee = lockedUsers.find(
          (user) => user.id === currentTask.assignedToId,
        );
        const replacement = lockedUsers.find(
          (user) => user.id === dto.assignedToId,
        );

        if (!replacement) {
          throw new NotFoundException('Assignee not found');
        }

        if (!replacement.isActive || replacement.role !== 'EMPLOYEE') {
          throw new BadRequestException(
            'Assignee must be an active employee',
          );
        }

        if (actor.role === 'MANAGER') {
          const managerOwnsTask =
            actor.teamId !== null &&
            currentTask.teamId !== null &&
            currentAssignee?.teamId === actor.teamId &&
            currentTask.teamId === actor.teamId &&
            replacement.teamId === actor.teamId;

          if (!managerOwnsTask) {
            throw new ForbiddenException(
              'Manager cannot reassign this task',
            );
          }
        }

        if (currentTask.assignedToId === replacement.id) {
          return { task: currentTask, changed: false };
        }

        const changedAt = new Date();
        const [updatedTask] = await tx
          .update(tasks)
          .set({
            assignedToId: replacement.id,
            teamId: replacement.teamId,
            updatedAt: changedAt,
          })
          .where(eq(tasks.id, id))
          .returning();

        if (!updatedTask) {
          throw new ConflictException('Task changed concurrently');
        }

        await tx.insert(taskActivities).values({
          taskId: id,
          actorUserId: actor.id,
          type: 'REASSIGNED',
          metadata: {
            previousAssigneeId: currentTask.assignedToId,
            newAssigneeId: replacement.id,
            previousTeamId: currentTask.teamId,
            newTeamId: replacement.teamId,
            actorId: actor.id,
            changedAt: changedAt.toISOString(),
          },
        });

        const [notification] = await tx.insert(notifications).values({
          recipientUserId: replacement.id,
          taskId: id,
          type: 'TASK_REASSIGNED',
          title: 'Task Reassigned to You',
          message: `You have been assigned the task "${currentTask.title}".`,
        }).returning();

        return { task: updatedTask, changed: true, notification };
      });
    } catch (error) {
      this.rethrowTaskMutationError(error);
    }

    await this.publishCommittedNotification(result.notification);
    return this.getTaskById(result.task.id);
  }

  private async publishCommittedNotification(
    notification: Notification | undefined,
  ): Promise<void> {
    if (!notification || !this.realtimeNotificationsService) {
      return;
    }

    try {
      await this.realtimeNotificationsService.publishNewNotification(
        notification,
      );
    } catch {
      // Realtime delivery must never invalidate a committed task mutation.
    }
  }

  private async findAssignee(id: string) {
    try {
      const [assignee] = await this.databaseService.db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          teamId: users.teamId,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!assignee) {
        throw new NotFoundException('Assignee not found');
      }

      if (!assignee.isActive || assignee.role !== 'EMPLOYEE') {
        throw new BadRequestException(
          'Assignee must be an active employee',
        );
      }

      return assignee;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Task operation failed');
    }
  }

  private parseDeadline(deadline: string | null | undefined): Date | null {
    if (deadline === undefined || deadline === null) {
      return null;
    }

    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(deadline)) {
      throw new BadRequestException(
        'deadline must include an explicit timezone offset',
      );
    }

    const parsed = new Date(deadline);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('deadline must be a valid date');
    }

    return parsed;
  }

  private assertStatusPermission(
    task: Task,
    currentUser: AuthenticatedUser,
  ): void {
    if (
      currentUser.role === 'ADMIN' ||
      (currentUser.role === 'EMPLOYEE' &&
        task.assignedToId === currentUser.id)
    ) {
      return;
    }

    throw new ForbiddenException('You cannot change this task status');
  }

  private isAllowedStatusTransition(
    previousStatus: Task['status'],
    nextStatus: Task['status'],
    currentUser: AuthenticatedUser,
  ): boolean {
    if (currentUser.role === 'ADMIN') {
      return true;
    }

    return (
      (previousStatus === 'PENDING' && nextStatus === 'WORKING') ||
      (previousStatus === 'WORKING' && nextStatus === 'DONE')
    );
  }

  private assertEditPermission(
    task: Task,
    currentUser: AuthenticatedUser,
  ): void {
    if (currentUser.role === 'ADMIN') {
      return;
    }

    if (
      (currentUser.role === 'EMPLOYEE' || currentUser.role === 'MANAGER') &&
      task.createdById === currentUser.id &&
      task.status === 'PENDING'
    ) {
      return;
    }

    throw new ForbiddenException('You cannot edit this task');
  }

  private hasEditableField(dto: UpdateTaskDto): boolean {
    return (['title', 'description', 'priority', 'deadline'] as const).some(
      (field) =>
        Object.prototype.hasOwnProperty.call(dto, field) &&
        dto[field] !== undefined,
    );
  }

  private buildTaskEdits(
    currentTask: Task,
    dto: UpdateTaskDto,
  ): {
    values: Partial<Pick<Task, EditableTaskField>>;
    metadata: Record<string, { previous: string | null; next: string | null }>;
  } {
    const values: Partial<Pick<Task, EditableTaskField>> = {};
    const metadata: Record<
      string,
      { previous: string | null; next: string | null }
    > = {};

    if (
      Object.prototype.hasOwnProperty.call(dto, 'title') &&
      dto.title !== undefined
    ) {
      if (typeof dto.title !== 'string') {
        throw new BadRequestException('title must be a string');
      }

      const title = dto.title.trim();
      if (title !== currentTask.title) {
        values.title = title;
        metadata.title = { previous: currentTask.title, next: title };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(dto, 'description') &&
      dto.description !== undefined
    ) {
      if (dto.description !== null && typeof dto.description !== 'string') {
        throw new BadRequestException('description must be a string or null');
      }

      if (dto.description !== currentTask.description) {
        values.description = dto.description ?? null;
        metadata.description = {
          previous: currentTask.description,
          next: dto.description ?? null,
        };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(dto, 'priority') &&
      dto.priority !== undefined
    ) {
      if (!dto.priority) {
        throw new BadRequestException('priority is invalid');
      }

      if (dto.priority !== currentTask.priority) {
        values.priority = dto.priority;
        metadata.priority = {
          previous: currentTask.priority,
          next: dto.priority,
        };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(dto, 'deadline') &&
      dto.deadline !== undefined
    ) {
      const deadline = this.parseDeadline(dto.deadline);
      const currentTime = currentTask.deadline?.getTime() ?? null;
      const nextTime = deadline?.getTime() ?? null;

      if (currentTime !== nextTime) {
        values.deadline = deadline;
        metadata.deadline = {
          previous: currentTask.deadline?.toISOString() ?? null,
          next: deadline?.toISOString() ?? null,
        };
      }
    }

    return { values, metadata };
  }

  private rethrowTaskMutationError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (this.isConcurrencyError(error)) {
      throw new ConflictException('Task changed concurrently');
    }

    throw new InternalServerErrorException('Task operation failed');
  }

  private isConcurrencyError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    const code = (error as { code?: unknown }).code;
    return code === '40001' || code === '40P01';
  }

  private buildTaskFilters(
    query: TaskFilterQuery,
    forcedAssigneeId?: string,
    now = new Date(),
  ): SQL<unknown> | undefined {
    const filters: SQL<unknown>[] = [];

    if (query.status) {
      filters.push(eq(tasks.status, query.status));
    }

    if (query.priority) {
      filters.push(eq(tasks.priority, query.priority));
    }

    if (query.assignedToId || forcedAssigneeId) {
      filters.push(eq(tasks.assignedToId, forcedAssigneeId ?? query.assignedToId!));
    }

    if (query.createdById) {
      filters.push(eq(tasks.createdById, query.createdById));
    }

    if (query.teamId) {
      filters.push(eq(tasks.teamId, query.teamId));
    }

    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      filters.push(ilike(tasks.title, pattern));
    }

    const deadlineFrom = query.deadlineFrom
      ? this.parseDeadline(query.deadlineFrom)
      : null;
    const deadlineTo = query.deadlineTo
      ? this.parseDeadline(query.deadlineTo)
      : null;

    if (deadlineFrom && deadlineTo && deadlineFrom > deadlineTo) {
      throw new BadRequestException(
        'deadlineFrom must not be later than deadlineTo',
      );
    }

    if (deadlineFrom) {
      filters.push(gte(tasks.deadline, deadlineFrom));
    }

    if (deadlineTo) {
      filters.push(lte(tasks.deadline, deadlineTo));
    }

    if (query.overdue === true) {
      filters.push(
        and(
          isNotNull(tasks.deadline),
          lt(tasks.deadline, now),
          ne(tasks.status, 'DONE'),
        )!,
      );
    }

    return filters.length > 0 ? and(...filters) : undefined;
  }

  private async selectTaskRows(
    where: SQL<unknown> | undefined,
    limit: number,
    offset: number,
    query?: Pick<TaskQueryDto, 'sortBy' | 'sortOrder'>,
  ): Promise<TaskJoinedRow[]> {
    return this.databaseService.db
      .select({
        taskId: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        taskTeamId: tasks.teamId,
        deadline: tasks.deadline,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        creatorId: creatorAlias.id,
        creatorFullName: creatorAlias.fullName,
        creatorEmail: creatorAlias.email,
        creatorRole: creatorAlias.role,
        creatorTeamId: creatorAlias.teamId,
        assigneeId: assigneeAlias.id,
        assigneeFullName: assigneeAlias.fullName,
        assigneeEmail: assigneeAlias.email,
        assigneeRole: assigneeAlias.role,
        assigneeTeamId: assigneeAlias.teamId,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(tasks)
      .innerJoin(creatorAlias, eq(tasks.createdById, creatorAlias.id))
      .innerJoin(assigneeAlias, eq(tasks.assignedToId, assigneeAlias.id))
      .leftJoin(teams, eq(tasks.teamId, teams.id))
      .where(where)
      .orderBy(...this.taskOrder(query))
      .limit(limit)
      .offset(offset);
  }

  private taskOrder(
    query?: Pick<TaskQueryDto, 'sortBy' | 'sortOrder'>,
  ): SQL<unknown>[] {
    const sortBy: TaskSortField = query?.sortBy ?? 'createdAt';
    const sortOrder: TaskSortOrder = query?.sortOrder ?? 'desc';
    const direction = sortOrder === 'asc' ? asc : desc;

    if (sortBy === 'updatedAt') {
      return [direction(tasks.updatedAt), direction(tasks.id)];
    }

    if (sortBy === 'deadline') {
      return [
        sql`${tasks.deadline} IS NULL`,
        direction(tasks.deadline),
        direction(tasks.id),
      ];
    }

    return [direction(tasks.createdAt), direction(tasks.id)];
  }

  private toTaskActivityResponse(
    row: TaskActivityJoinedRow,
  ): TaskActivityResponse {
    return {
      id: row.activityId,
      type: row.type,
      createdAt: row.createdAt,
      actor: {
        id: row.actorId,
        fullName: row.actorFullName,
        email: row.actorEmail,
        role: row.actorRole,
        teamId: row.actorTeamId,
      },
      metadata: this.safeActivityMetadata(row.type, row.metadata),
    };
  }

  private safeActivityMetadata(
    type: TaskActivityResponse['type'],
    rawMetadata: unknown,
  ): Record<string, unknown> | null {
    if (
      rawMetadata === null ||
      typeof rawMetadata !== 'object' ||
      Array.isArray(rawMetadata)
    ) {
      return null;
    }

    const source = rawMetadata as Record<string, unknown>;
    const metadata: Record<string, unknown> = {};
    const addString = (key: string, nullable = false) => {
      const value = source[key];
      if (typeof value === 'string' || (nullable && value === null)) {
        metadata[key] = value;
      }
    };

    if (type === 'STATUS_CHANGED') {
      addString('previousStatus');
      addString('newStatus');
      addString('actorUserId');
      addString('changedAt');
    }

    if (type === 'REASSIGNED') {
      addString('previousAssigneeId');
      addString('newAssigneeId');
      addString('previousTeamId', true);
      addString('newTeamId', true);
      addString('actorId');
      addString('changedAt');
    }

    if (type === 'UPDATED') {
      addString('actorUserId');
      addString('changedAt');

      const rawChanges = source.changes;
      if (
        rawChanges !== null &&
        typeof rawChanges === 'object' &&
        !Array.isArray(rawChanges)
      ) {
        const changes: Record<string, unknown> = {};
        const sourceChanges = rawChanges as Record<string, unknown>;

        for (const field of [
          'title',
          'description',
          'priority',
          'deadline',
        ]) {
          const rawChange = sourceChanges[field];
          if (
            rawChange === null ||
            typeof rawChange !== 'object' ||
            Array.isArray(rawChange)
          ) {
            continue;
          }

          const change = rawChange as Record<string, unknown>;
          const previous = change.previous;
          const next = change.next;
          const validPrevious =
            typeof previous === 'string' || previous === null;
          const validNext = typeof next === 'string' || next === null;

          if (validPrevious && validNext) {
            changes[field] = { previous, next };
          }
        }

        if (Object.keys(changes).length > 0) {
          metadata.changes = changes;
        }
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  private toTaskResponse(row: TaskJoinedRow): TaskResponse {
    const creator: PublicTaskUser = {
      id: row.creatorId,
      fullName: row.creatorFullName,
      email: row.creatorEmail,
      role: row.creatorRole,
      teamId: row.creatorTeamId,
    };
    const assignee: PublicTaskUser = {
      id: row.assigneeId,
      fullName: row.assigneeFullName,
      email: row.assigneeEmail,
      role: row.assigneeRole,
      teamId: row.assigneeTeamId,
    };
    const team: PublicTaskTeam | null = row.teamId
      ? { id: row.teamId, name: row.teamName! }
      : null;

    return {
      id: row.taskId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      teamId: row.taskTeamId,
      deadline: row.deadline,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      creator,
      assignee,
      team,
    };
  }

  private pagination(
    page: number,
    limit: number,
    total: number,
  ): { page: number; limit: number; total: number; totalPages: number } {
    return {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }
}
