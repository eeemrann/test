import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import type { Task } from '../database/schema.js';
import { TasksService } from './tasks.service.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import type { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_EMPLOYEE_ID = '44444444-4444-4444-8444-444444444444';
const TASK_ID = '77777777-7777-4777-8777-777777777777';
const TEAM_ID = '55555555-5555-4555-8555-555555555555';

function user(
  role: AuthenticatedUser['role'],
  id: string,
): AuthenticatedUser {
  return {
    id,
    fullName: `${role} User`,
    email: `${role.toLowerCase()}@office.local`,
    role,
    teamId: TEAM_ID,
    isActive: true,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: TASK_ID,
    title: 'Original title',
    description: 'Original description',
    status: 'PENDING',
    priority: 'MEDIUM',
    createdById: EMPLOYEE_ID,
    assignedToId: EMPLOYEE_ID,
    teamId: TEAM_ID,
    deadline: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeService(options: {
  currentTask?: Task | null;
  lockedTaskError?: unknown;
  updateResult?: Task[];
  activityError?: Error;
} = {}) {
  const currentTask = options.currentTask === null ? undefined : options.currentTask ?? task();
  const activityValues = options.activityError
    ? vi.fn().mockRejectedValue(options.activityError)
    : vi.fn().mockResolvedValue([]);
  const notificationValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([
      {
        id: '88888888-8888-4888-8888-888888888888',
        recipientUserId: EMPLOYEE_ID,
        taskId: TASK_ID,
        type: 'TASK_STATUS_CHANGED',
        title: 'Task changed',
        message: 'A task changed.',
        readAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]),
  });
  const lockWhere = vi.fn().mockReturnValue({
    for: options.lockedTaskError
      ? vi.fn().mockRejectedValue(options.lockedTaskError)
      : vi.fn().mockResolvedValue([currentTask]),
  });
  const selectFrom = vi.fn().mockReturnValue({ where: lockWhere });
  const updateReturning = vi.fn().mockResolvedValue(
    options.updateResult ?? (currentTask ? [currentTask] : []),
  );
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const tx = {
    select: vi.fn().mockReturnValue({ from: selectFrom }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
    insert: vi
      .fn()
      .mockReturnValueOnce({ values: activityValues })
      .mockReturnValueOnce({ values: notificationValues }),
  };
  const db = {
    transaction: vi.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const service = new TasksService({ db } as never);
  vi.spyOn(service, 'getTaskById').mockResolvedValue({
    ...taskResponse(currentTask ?? task()),
  });

  return {
    service,
    db,
    tx,
    updateSet,
    updateReturning,
    activityValues,
    notificationValues,
  };
}

function taskResponse(current: Task) {
  return {
    id: current.id,
    title: current.title,
    description: current.description,
    status: current.status,
    priority: current.priority,
    teamId: current.teamId,
    deadline: current.deadline,
    completedAt: current.completedAt,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
    creator: {
      id: current.createdById,
      fullName: 'Creator',
      email: 'creator@office.local',
      role: 'EMPLOYEE' as const,
      teamId: TEAM_ID,
    },
    assignee: {
      id: current.assignedToId,
      fullName: 'Assignee',
      email: 'assignee@office.local',
      role: 'EMPLOYEE' as const,
      teamId: TEAM_ID,
    },
    team: { id: TEAM_ID, name: 'Engineering' },
  };
}

describe('TasksService mutations', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows an assigned employee to start a pending task', async () => {
    const { service, updateSet, activityValues } = makeService();

    await service.updateTaskStatus(
      TASK_ID,
      { status: 'WORKING' } as UpdateTaskStatusDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'WORKING', completedAt: null }),
    );
    expect(activityValues).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STATUS_CHANGED' }),
    );
  });

  it('allows an assigned employee to complete a working task', async () => {
    const { service, updateSet } = makeService({
      currentTask: task({ status: 'WORKING' }),
    });

    await service.updateTaskStatus(
      TASK_ID,
      { status: 'DONE' } as UpdateTaskStatusDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DONE', completedAt: expect.any(Date) }),
    );
  });

  it('rejects an employee skipping pending directly to done', async () => {
    const { service, tx } = makeService();

    await expect(
      service.updateTaskStatus(
        TASK_ID,
        { status: 'DONE' } as UpdateTaskStatusDto,
        user('EMPLOYEE', EMPLOYEE_ID),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects an employee changing another employee task', async () => {
    const { service } = makeService({
      currentTask: task({ assignedToId: OTHER_EMPLOYEE_ID }),
    });

    await expect(
      service.updateTaskStatus(
        TASK_ID,
        { status: 'WORKING' } as UpdateTaskStatusDto,
        user('EMPLOYEE', EMPLOYEE_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects managers changing status', async () => {
    const { service } = makeService();

    await expect(
      service.updateTaskStatus(
        TASK_ID,
        { status: 'WORKING' } as UpdateTaskStatusDto,
        user('MANAGER', MANAGER_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admins to change any task status', async () => {
    const { service, updateSet } = makeService({
      currentTask: task({ assignedToId: OTHER_EMPLOYEE_ID }),
    });

    await service.updateTaskStatus(
      TASK_ID,
      { status: 'DONE' } as UpdateTaskStatusDto,
      user('ADMIN', ADMIN_ID),
    );

    expect(updateSet).toHaveBeenCalled();
  });

  it('allows admins to reopen a done task and clears completedAt', async () => {
    const { service, updateSet } = makeService({
      currentTask: task({
        status: 'DONE',
        completedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    });

    await service.updateTaskStatus(
      TASK_ID,
      { status: 'WORKING' } as UpdateTaskStatusDto,
      user('ADMIN', ADMIN_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'WORKING', completedAt: null }),
    );
  });

  it('clears completedAt when an admin reopens to pending', async () => {
    const { service, updateSet } = makeService({
      currentTask: task({
        status: 'DONE',
        completedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    });

    await service.updateTaskStatus(
      TASK_ID,
      { status: 'PENDING' } as UpdateTaskStatusDto,
      user('ADMIN', ADMIN_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', completedAt: null }),
    );
  });

  it('does not create writes for a no-op status update', async () => {
    const { service, tx, activityValues, notificationValues } = makeService();

    await service.updateTaskStatus(
      TASK_ID,
      { status: 'PENDING' } as UpdateTaskStatusDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(tx.update).not.toHaveBeenCalled();
    expect(activityValues).not.toHaveBeenCalled();
    expect(notificationValues).not.toHaveBeenCalled();
  });

  it('notifies a different creator after a status change', async () => {
    const { service, notificationValues } = makeService({
      currentTask: task({ createdById: MANAGER_ID }),
    });

    await service.updateTaskStatus(
      TASK_ID,
      { status: 'WORKING' } as UpdateTaskStatusDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(notificationValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: MANAGER_ID,
        type: 'TASK_STATUS_CHANGED',
      }),
    );
  });

  it('does not notify the creator when the creator changes status', async () => {
    const { service, notificationValues } = makeService();

    await service.updateTaskStatus(
      TASK_ID,
      { status: 'WORKING' } as UpdateTaskStatusDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(notificationValues).not.toHaveBeenCalled();
  });

  it('maps a serialization failure to conflict without leaking SQL details', async () => {
    const { service } = makeService({ lockedTaskError: { code: '40001' } });

    await expect(
      service.updateTaskStatus(
        TASK_ID,
        { status: 'WORKING' } as UpdateTaskStatusDto,
        user('EMPLOYEE', EMPLOYEE_ID),
      ),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({ message: 'Task changed concurrently' }),
    });
  });

  it('returns not found when the locked task does not exist', async () => {
    const { service } = makeService({
      currentTask: null,
    });

    await expect(
      service.updateTaskStatus(
        TASK_ID,
        { status: 'WORKING' } as UpdateTaskStatusDto,
        user('EMPLOYEE', EMPLOYEE_ID),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a task creator to edit a pending task', async () => {
    const { service, updateSet, activityValues } = makeService();

    await service.updateTask(
      TASK_ID,
      { title: 'Updated title' } as UpdateTaskDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated title', updatedAt: expect.any(Date) }),
    );
    expect(activityValues).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UPDATED' }),
    );
  });

  it('rejects a creator editing a working task', async () => {
    const { service } = makeService({ currentTask: task({ status: 'WORKING' }) });

    await expect(
      service.updateTask(
        TASK_ID,
        { title: 'Blocked' } as UpdateTaskDto,
        user('EMPLOYEE', EMPLOYEE_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an employee editing another creator task', async () => {
    const { service } = makeService({ currentTask: task({ createdById: MANAGER_ID }) });

    await expect(
      service.updateTask(
        TASK_ID,
        { title: 'Blocked' } as UpdateTaskDto,
        user('EMPLOYEE', EMPLOYEE_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a manager to edit a pending task they created', async () => {
    const { service, updateSet } = makeService({
      currentTask: task({ createdById: MANAGER_ID }),
    });

    await service.updateTask(
      TASK_ID,
      { priority: 'HIGH' } as UpdateTaskDto,
      user('MANAGER', MANAGER_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'HIGH' }),
    );
  });

  it('allows an admin to edit a completed task', async () => {
    const { service, updateSet } = makeService({
      currentTask: task({
        status: 'DONE',
        completedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    });

    await service.updateTask(
      TASK_ID,
      { description: 'Administrative correction' } as UpdateTaskDto,
      user('ADMIN', ADMIN_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Administrative correction' }),
    );
  });

  it('supports clearing optional description and deadline fields', async () => {
    const { service, updateSet } = makeService({
      currentTask: task({
        description: 'Existing',
        deadline: new Date('2026-02-01T00:00:00.000Z'),
      }),
    });

    await service.updateTask(
      TASK_ID,
      { description: null, deadline: null } as UpdateTaskDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ description: null, deadline: null }),
    );
  });

  it('rejects an empty edit body', async () => {
    const { service } = makeService();

    await expect(
      service.updateTask(TASK_ID, {} as UpdateTaskDto, user('ADMIN', ADMIN_ID)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not create writes when all edited values are unchanged', async () => {
    const { service, tx } = makeService();

    await service.updateTask(
      TASK_ID,
      {
        title: 'Original title',
        description: 'Original description',
        priority: 'MEDIUM',
        deadline: null,
      } as UpdateTaskDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('records changed fields in safe update activity metadata', async () => {
    const { service, activityValues } = makeService();

    await service.updateTask(
      TASK_ID,
      { title: 'New title', priority: 'URGENT' } as UpdateTaskDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(activityValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATED',
        metadata: expect.objectContaining({
          changes: expect.objectContaining({
            title: { previous: 'Original title', next: 'New title' },
            priority: { previous: 'MEDIUM', next: 'URGENT' },
          }),
        }),
      }),
    );
  });

  it('notifies a different assignee after a detail edit', async () => {
    const { service, notificationValues } = makeService({
      currentTask: task({ assignedToId: OTHER_EMPLOYEE_ID }),
    });

    await service.updateTask(
      TASK_ID,
      { title: 'Changed' } as UpdateTaskDto,
      user('ADMIN', ADMIN_ID),
    );

    expect(notificationValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: OTHER_EMPLOYEE_ID,
        type: 'TASK_UPDATED',
      }),
    );
  });

  it('does not notify the assignee when the assignee edits the task', async () => {
    const { service, notificationValues } = makeService();

    await service.updateTask(
      TASK_ID,
      { title: 'Changed by assignee' } as UpdateTaskDto,
      user('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(notificationValues).not.toHaveBeenCalled();
  });

  it('rejects a deadline without an explicit timezone', async () => {
    const { service } = makeService();

    await expect(
      service.updateTask(
        TASK_ID,
        { deadline: '2026-02-01T12:00:00' } as UpdateTaskDto,
        user('EMPLOYEE', EMPLOYEE_ID),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects protected field injection even when called below the controller', async () => {
    const { service } = makeService();

    await expect(
      service.updateTask(
        TASK_ID,
        { status: 'DONE', assignedToId: OTHER_EMPLOYEE_ID } as never,
        user('ADMIN', ADMIN_ID),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a generic error when activity persistence fails', async () => {
    const { service } = makeService({
      activityError: new Error('database detail must not escape'),
    });

    await expect(
      service.updateTask(
        TASK_ID,
        { title: 'Transactional edit' } as UpdateTaskDto,
        user('ADMIN', ADMIN_ID),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('maps a missing locked task during editing to 404', async () => {
    const { service } = makeService({
      currentTask: null,
    });

    await expect(
      service.updateTask(
        TASK_ID,
        { title: 'Missing task' } as UpdateTaskDto,
        user('ADMIN', ADMIN_ID),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
