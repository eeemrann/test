import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import type { Task } from '../database/schema.js';
import { ReassignTaskDto } from './dto/reassign-task.dto.js';
import { TasksService } from './tasks.service.js';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const ENGINEERING_MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const OPERATIONS_MANAGER_ID = '33333333-3333-4333-8333-333333333333';
const ENGINEERING_EMPLOYEE_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_ENGINEERING_EMPLOYEE_ID = '55555555-5555-4555-8555-555555555555';
const OPERATIONS_EMPLOYEE_ID = '66666666-6666-4666-8666-666666666666';
const TEAMLESS_EMPLOYEE_ID = '77777777-7777-4777-8777-777777777777';
const TASK_ID = '88888888-8888-4888-8888-888888888888';
const ENGINEERING_TEAM_ID = '99999999-9999-4999-8999-999999999999';
const OPERATIONS_TEAM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type LockedUser = {
  id: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  teamId: string | null;
  isActive: boolean;
};

function authUser(
  role: AuthenticatedUser['role'],
  id: string,
  teamId: string | null,
): AuthenticatedUser {
  return {
    id,
    fullName: `${role} User`,
    email: `${role.toLowerCase()}@office.local`,
    role,
    teamId,
    isActive: true,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: TASK_ID,
    title: 'Reassignment fixture',
    description: 'Fixture',
    status: 'WORKING',
    priority: 'HIGH',
    createdById: ENGINEERING_MANAGER_ID,
    assignedToId: ENGINEERING_EMPLOYEE_ID,
    teamId: ENGINEERING_TEAM_ID,
    deadline: new Date('2026-02-01T00:00:00.000Z'),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function taskResponse(currentTask: Task) {
  return {
    id: currentTask.id,
    title: currentTask.title,
    description: currentTask.description,
    status: currentTask.status,
    priority: currentTask.priority,
    teamId: currentTask.teamId,
    deadline: currentTask.deadline,
    completedAt: currentTask.completedAt,
    createdAt: currentTask.createdAt,
    updatedAt: currentTask.updatedAt,
    creator: {
      id: currentTask.createdById,
      fullName: 'Creator',
      email: 'creator@office.local',
      role: 'MANAGER' as const,
      teamId: ENGINEERING_TEAM_ID,
    },
    assignee: {
      id: currentTask.assignedToId,
      fullName: 'Assignee',
      email: 'assignee@office.local',
      role: 'EMPLOYEE' as const,
      teamId: currentTask.teamId,
    },
    team: currentTask.teamId
      ? { id: currentTask.teamId, name: 'Fixture Team' }
      : null,
  };
}

function makeService(options: {
  actor?: LockedUser;
  currentTask?: Task | null;
  currentAssignee?: LockedUser;
  replacement?: LockedUser;
  users?: LockedUser[];
  updateResult?: Task[];
  activityError?: Error;
  lockError?: unknown;
} = {}) {
  const currentTask =
    options.currentTask === null ? undefined : options.currentTask ?? task();
  const actor =
    options.actor ??
    ({
      id: ENGINEERING_MANAGER_ID,
      role: 'MANAGER',
      teamId: ENGINEERING_TEAM_ID,
      isActive: true,
    } satisfies LockedUser);
  const currentAssignee =
    options.currentAssignee ??
    ({
      id: ENGINEERING_EMPLOYEE_ID,
      role: 'EMPLOYEE',
      teamId: ENGINEERING_TEAM_ID,
      isActive: true,
    } satisfies LockedUser);
  const replacement =
    options.replacement ??
    ({
      id: OTHER_ENGINEERING_EMPLOYEE_ID,
      role: 'EMPLOYEE',
      teamId: ENGINEERING_TEAM_ID,
      isActive: true,
    } satisfies LockedUser);
  const lockedUsers = options.users ?? [actor, currentAssignee, replacement];
  const activityValues = options.activityError
    ? vi.fn().mockRejectedValue(options.activityError)
    : vi.fn().mockResolvedValue([]);
  const notificationValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        recipientUserId: OPERATIONS_EMPLOYEE_ID,
        taskId: TASK_ID,
        type: 'TASK_REASSIGNED',
        title: 'Task reassigned',
        message: 'A task was reassigned.',
        readAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]),
  });
  const taskWhere = {
    for: options.lockError
      ? vi.fn().mockRejectedValue(options.lockError)
      : vi.fn().mockResolvedValue(currentTask ? [currentTask] : []),
  };
  const taskFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue(taskWhere),
  });
  const userLock = vi.fn().mockResolvedValue(lockedUsers);
  const userFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({ for: userLock }),
    }),
  });
  const updateReturning = vi.fn().mockResolvedValue(
    options.updateResult ?? (currentTask ? [currentTask] : []),
  );
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const tx = {
    select: vi
      .fn()
      .mockReturnValueOnce({ from: taskFrom })
      .mockReturnValueOnce({ from: userFrom }),
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
  vi.spyOn(service, 'getTaskById').mockResolvedValue(
    taskResponse(currentTask ?? task()),
  );

  return {
    service,
    tx,
    updateSet,
    activityValues,
    notificationValues,
    userLock,
  };
}

describe('TasksService reassignment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows an Engineering Manager to reassign within Engineering', async () => {
    const { service, updateSet } = makeService();

    await service.reassignTask(
      TASK_ID,
      { assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID },
      authUser('MANAGER', ENGINEERING_MANAGER_ID, ENGINEERING_TEAM_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID,
        teamId: ENGINEERING_TEAM_ID,
      }),
    );
  });

  it('allows an Operations Manager to reassign within Operations', async () => {
    const { service, updateSet } = makeService({
      actor: {
        id: OPERATIONS_MANAGER_ID,
        role: 'MANAGER',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
      currentTask: task({
        createdById: OPERATIONS_MANAGER_ID,
        assignedToId: OPERATIONS_EMPLOYEE_ID,
        teamId: OPERATIONS_TEAM_ID,
      }),
      currentAssignee: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
      replacement: {
        id: TEAMLESS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
    });

    await service.reassignTask(
      TASK_ID,
      { assignedToId: TEAMLESS_EMPLOYEE_ID },
      authUser('MANAGER', OPERATIONS_MANAGER_ID, OPERATIONS_TEAM_ID),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: OPERATIONS_TEAM_ID }),
    );
  });

  it.each([
    ['Engineering Manager', ENGINEERING_MANAGER_ID, ENGINEERING_TEAM_ID, OPERATIONS_TEAM_ID],
    ['Operations Manager', OPERATIONS_MANAGER_ID, OPERATIONS_TEAM_ID, ENGINEERING_TEAM_ID],
  ] as const)('%s cannot reassign a task owned by another team', async (_, managerId, managerTeamId, taskTeamId) => {
    const { service } = makeService({
      actor: { id: managerId, role: 'MANAGER', teamId: managerTeamId, isActive: true },
      currentTask: task({ teamId: taskTeamId }),
      currentAssignee: {
        id: ENGINEERING_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: taskTeamId,
        isActive: true,
      },
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID },
        authUser('MANAGER', managerId, managerTeamId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a manager assigning to an employee in another team', async () => {
    const { service } = makeService({
      replacement: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OPERATIONS_EMPLOYEE_ID },
        authUser('MANAGER', ENGINEERING_MANAGER_ID, ENGINEERING_TEAM_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a manager without a team', async () => {
    const { service } = makeService({
      actor: {
        id: ENGINEERING_MANAGER_ID,
        role: 'MANAGER',
        teamId: null,
        isActive: true,
      },
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID },
        authUser('MANAGER', ENGINEERING_MANAGER_ID, null),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a manager when task ownership is teamless or stale', async () => {
    const { service } = makeService({
      currentTask: task({ teamId: null }),
      currentAssignee: {
        id: ENGINEERING_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: ENGINEERING_TEAM_ID,
        isActive: true,
      },
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID },
        authUser('MANAGER', ENGINEERING_MANAGER_ID, ENGINEERING_TEAM_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not grant authority to the creator of a cross-team task', async () => {
    const { service } = makeService({
      currentTask: task({
        createdById: ENGINEERING_MANAGER_ID,
        teamId: OPERATIONS_TEAM_ID,
      }),
      currentAssignee: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID },
        authUser('MANAGER', ENGINEERING_MANAGER_ID, ENGINEERING_TEAM_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an employee reassignment attempt', async () => {
    const { service } = makeService({
      actor: {
        id: ENGINEERING_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: ENGINEERING_TEAM_ID,
        isActive: true,
      },
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID },
        authUser('EMPLOYEE', ENGINEERING_EMPLOYEE_ID, ENGINEERING_TEAM_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['Engineering to Operations', OPERATIONS_EMPLOYEE_ID, OPERATIONS_TEAM_ID],
    ['Operations to Engineering', ENGINEERING_EMPLOYEE_ID, ENGINEERING_TEAM_ID],
  ] as const)('allows Admin %s reassignment', async (_, replacementId, replacementTeamId) => {
    const movesFromOperations = replacementId === ENGINEERING_EMPLOYEE_ID;
    const { service, updateSet } = makeService({
      actor: {
        id: ADMIN_ID,
        role: 'ADMIN',
        teamId: null,
        isActive: true,
      },
      currentTask: movesFromOperations
        ? task({
            assignedToId: OPERATIONS_EMPLOYEE_ID,
            teamId: OPERATIONS_TEAM_ID,
          })
        : undefined,
      currentAssignee: movesFromOperations
        ? {
            id: OPERATIONS_EMPLOYEE_ID,
            role: 'EMPLOYEE',
            teamId: OPERATIONS_TEAM_ID,
            isActive: true,
          }
        : undefined,
      replacement: {
        id: replacementId,
        role: 'EMPLOYEE',
        teamId: replacementTeamId,
        isActive: true,
      },
    });

    await service.reassignTask(
      TASK_ID,
      { assignedToId: replacementId },
      authUser('ADMIN', ADMIN_ID, null),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedToId: replacementId,
        teamId: replacementTeamId,
      }),
    );
  });

  it('allows Admin reassignment from a teamless task', async () => {
    const { service, updateSet } = makeService({
      actor: { id: ADMIN_ID, role: 'ADMIN', teamId: null, isActive: true },
      currentTask: task({
        assignedToId: TEAMLESS_EMPLOYEE_ID,
        teamId: null,
      }),
      currentAssignee: {
        id: TEAMLESS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: null,
        isActive: true,
      },
      replacement: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
    });

    await service.reassignTask(
      TASK_ID,
      { assignedToId: OPERATIONS_EMPLOYEE_ID },
      authUser('ADMIN', ADMIN_ID, null),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: OPERATIONS_TEAM_ID }),
    );
  });

  it('allows Admin assignment to a teamless active employee', async () => {
    const { service, updateSet } = makeService({
      actor: { id: ADMIN_ID, role: 'ADMIN', teamId: null, isActive: true },
      replacement: {
        id: TEAMLESS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: null,
        isActive: true,
      },
    });

    await service.reassignTask(
      TASK_ID,
      { assignedToId: TEAMLESS_EMPLOYEE_ID },
      authUser('ADMIN', ADMIN_ID, null),
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedToId: TEAMLESS_EMPLOYEE_ID,
        teamId: null,
      }),
    );
  });

  it.each([
    ['manager', 'MANAGER'],
    ['admin', 'ADMIN'],
  ] as const)('rejects assigning to a %s account', async (_, role) => {
    const { service } = makeService({
      actor: { id: ADMIN_ID, role: 'ADMIN', teamId: null, isActive: true },
      replacement: {
        id: OPERATIONS_MANAGER_ID,
        role,
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OPERATIONS_MANAGER_ID },
        authUser('ADMIN', ADMIN_ID, null),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive employee', async () => {
    const { service } = makeService({
      actor: { id: ADMIN_ID, role: 'ADMIN', teamId: null, isActive: true },
      replacement: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: false,
      },
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OPERATIONS_EMPLOYEE_ID },
        authUser('ADMIN', ADMIN_ID, null),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 for a nonexistent replacement employee', async () => {
    const { service } = makeService({
      replacement: undefined,
      users: [
        {
          id: ENGINEERING_MANAGER_ID,
          role: 'MANAGER',
          teamId: ENGINEERING_TEAM_ID,
          isActive: true,
        },
        {
          id: ENGINEERING_EMPLOYEE_ID,
          role: 'EMPLOYEE',
          teamId: ENGINEERING_TEAM_ID,
          isActive: true,
        },
      ],
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OPERATIONS_EMPLOYEE_ID },
        authUser('MANAGER', ENGINEERING_MANAGER_ID, ENGINEERING_TEAM_ID),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for a missing task', async () => {
    const { service } = makeService({ currentTask: null });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID },
        authUser('ADMIN', ADMIN_ID, null),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates team ownership while preserving creator, status, and completedAt', async () => {
    const existing = task({
      status: 'DONE',
      completedAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    const { service, updateSet } = makeService({
      actor: { id: ADMIN_ID, role: 'ADMIN', teamId: null, isActive: true },
      currentTask: existing,
      updateResult: [
        task({
          ...existing,
          assignedToId: OPERATIONS_EMPLOYEE_ID,
          teamId: OPERATIONS_TEAM_ID,
        }),
      ],
      replacement: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
    });

    await service.reassignTask(
      TASK_ID,
      { assignedToId: OPERATIONS_EMPLOYEE_ID },
      authUser('ADMIN', ADMIN_ID, null),
    );

    const changes = updateSet.mock.calls[0][0] as Record<string, unknown>;
    expect(changes).toMatchObject({
      assignedToId: OPERATIONS_EMPLOYEE_ID,
      teamId: OPERATIONS_TEAM_ID,
    });
    expect(changes).not.toHaveProperty('createdById');
    expect(changes).not.toHaveProperty('status');
    expect(changes).not.toHaveProperty('completedAt');
  });

  it('creates a REASSIGNED activity with safe metadata', async () => {
    const { service, activityValues } = makeService({
      actor: { id: ADMIN_ID, role: 'ADMIN', teamId: null, isActive: true },
      replacement: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
    });

    await service.reassignTask(
      TASK_ID,
      { assignedToId: OPERATIONS_EMPLOYEE_ID },
      authUser('ADMIN', ADMIN_ID, null),
    );

    expect(activityValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REASSIGNED',
        metadata: expect.objectContaining({
          previousAssigneeId: ENGINEERING_EMPLOYEE_ID,
          newAssigneeId: OPERATIONS_EMPLOYEE_ID,
          actorId: ADMIN_ID,
          previousTeamId: ENGINEERING_TEAM_ID,
          newTeamId: OPERATIONS_TEAM_ID,
        }),
      }),
    );
  });

  it('creates one reassignment notification for the replacement employee', async () => {
    const { service, notificationValues } = makeService({
      actor: { id: ADMIN_ID, role: 'ADMIN', teamId: null, isActive: true },
      replacement: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
    });

    await service.reassignTask(
      TASK_ID,
      { assignedToId: OPERATIONS_EMPLOYEE_ID },
      authUser('ADMIN', ADMIN_ID, null),
    );

    expect(notificationValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: OPERATIONS_EMPLOYEE_ID,
        type: 'TASK_REASSIGNED',
      }),
    );
  });

  it('makes same-assignee reassignment a permission-checked no-op', async () => {
    const { service, tx, activityValues, notificationValues } = makeService({
      replacement: {
        id: ENGINEERING_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: ENGINEERING_TEAM_ID,
        isActive: true,
      },
    });

    await service.reassignTask(
      TASK_ID,
      { assignedToId: ENGINEERING_EMPLOYEE_ID },
      authUser('MANAGER', ENGINEERING_MANAGER_ID, ENGINEERING_TEAM_ID),
    );

    expect(tx.update).not.toHaveBeenCalled();
    expect(activityValues).not.toHaveBeenCalled();
    expect(notificationValues).not.toHaveBeenCalled();
  });

  it('rolls back when activity persistence fails', async () => {
    const { service } = makeService({
      actor: { id: ADMIN_ID, role: 'ADMIN', teamId: null, isActive: true },
      replacement: {
        id: OPERATIONS_EMPLOYEE_ID,
        role: 'EMPLOYEE',
        teamId: OPERATIONS_TEAM_ID,
        isActive: true,
      },
      activityError: new Error('transaction failure'),
    });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OPERATIONS_EMPLOYEE_ID },
        authUser('ADMIN', ADMIN_ID, null),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('maps serialization errors to HTTP 409', async () => {
    const { service } = makeService({ lockError: { code: '40001' } });

    await expect(
      service.reassignTask(
        TASK_ID,
        { assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID },
        authUser('MANAGER', ENGINEERING_MANAGER_ID, ENGINEERING_TEAM_ID),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates the reassignment DTO UUID and rejects unexpected fields', async () => {
    const valid = plainToInstance(ReassignTaskDto, {
      assignedToId: OTHER_ENGINEERING_EMPLOYEE_ID,
    });
    const invalid = plainToInstance(ReassignTaskDto, {
      assignedToId: 'not-a-uuid',
      teamId: ENGINEERING_TEAM_ID,
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
