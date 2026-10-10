import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { TasksService } from './tasks.service.js';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_EMPLOYEE_ID = '44444444-4444-4444-8444-444444444444';
const TEAM_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_TEAM_ID = '66666666-6666-4666-8666-666666666666';
const TASK_ID = '77777777-7777-4777-8777-777777777777';

function currentUser(
  role: AuthenticatedUser['role'],
  id: string,
  teamId: string | null = TEAM_ID,
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

function taskRow() {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: TASK_ID,
    title: 'A test task',
    description: 'Details',
    status: 'PENDING' as const,
    priority: 'MEDIUM' as const,
    createdById: MANAGER_ID,
    assignedToId: EMPLOYEE_ID,
    teamId: TEAM_ID,
    deadline: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function responseRow() {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    taskId: TASK_ID,
    title: 'A test task',
    description: 'Details',
    status: 'PENDING' as const,
    priority: 'MEDIUM' as const,
    taskTeamId: TEAM_ID,
    deadline: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    creatorId: MANAGER_ID,
    creatorFullName: 'Manager User',
    creatorEmail: 'manager@office.local',
    creatorRole: 'MANAGER' as const,
    creatorTeamId: TEAM_ID,
    assigneeId: EMPLOYEE_ID,
    assigneeFullName: 'Employee User',
    assigneeEmail: 'employee@office.local',
    assigneeRole: 'EMPLOYEE' as const,
    assigneeTeamId: TEAM_ID,
    teamId: TEAM_ID,
    teamName: 'Engineering',
  };
}

function makeDb(options: {
  assignee?: {
    id: string;
    fullName: string;
    email: string;
    role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
    teamId: string | null;
    isActive: boolean;
  }[];
  taskInsertError?: Error;
} = { assignee: undefined }) {
  const assignee =
    options.assignee ?? [
      {
        id: EMPLOYEE_ID,
        fullName: 'Employee User',
        email: 'employee@office.local',
        role: 'EMPLOYEE' as const,
        teamId: TEAM_ID,
        isActive: true,
      },
    ];
  const taskValues = vi.fn().mockReturnValue({
    returning: options.taskInsertError
      ? vi.fn().mockRejectedValue(options.taskInsertError)
      : vi.fn().mockResolvedValue([taskRow()]),
  });
  const activityValues = vi.fn().mockResolvedValue([]);
  const notificationValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([
      {
        id: '88888888-8888-4888-8888-888888888888',
        recipientUserId: EMPLOYEE_ID,
        taskId: TASK_ID,
        type: 'TASK_ASSIGNED',
        title: 'Task assigned',
        message: 'A new task has been assigned to you.',
        readAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]),
  });
  const tx = {
    insert: vi
      .fn()
      .mockReturnValueOnce({ values: taskValues })
      .mockReturnValueOnce({ values: activityValues })
      .mockReturnValueOnce({ values: notificationValues }),
  };
  const selectWhere = vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue(assignee),
  });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const db = {
    select: vi.fn().mockReturnValue({ from: selectFrom }),
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  return { db, tx, taskValues, activityValues, notificationValues };
}

function makeService(options?: Parameters<typeof makeDb>[0]) {
  const { db, ...mocks } = makeDb(options);
  const service = new TasksService({ db } as never);
  vi.spyOn(service, 'getTaskById').mockResolvedValue({
    id: TASK_ID,
    title: 'A test task',
    description: 'Details',
    status: 'PENDING',
    priority: 'MEDIUM',
    teamId: TEAM_ID,
    deadline: null,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    creator: {
      id: MANAGER_ID,
      fullName: 'Manager User',
      email: 'manager@office.local',
      role: 'MANAGER',
      teamId: TEAM_ID,
    },
    assignee: {
      id: EMPLOYEE_ID,
      fullName: 'Employee User',
      email: 'employee@office.local',
      role: 'EMPLOYEE',
      teamId: TEAM_ID,
    },
    team: { id: TEAM_ID, name: 'Engineering' },
  });
  return { service, db, ...mocks };
}

function restoreGetTaskById(service: TasksService): void {
  (service.getTaskById as unknown as { mockRestore: () => void }).mockRestore();
}

describe('TasksService', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['employee', 'EMPLOYEE', EMPLOYEE_ID],
    ['manager', 'MANAGER', MANAGER_ID],
    ['admin', 'ADMIN', ADMIN_ID],
  ] as const)('allows an authenticated %s to create a task', async (_, role, id) => {
    const { service } = makeService();

    const result = await service.createTask(
      { title: 'A test task', assignedToId: EMPLOYEE_ID },
      currentUser(role, id),
    );

    expect(result.status).toBe('PENDING');
    expect(result.priority).toBe('MEDIUM');
  });

  it('allows cross-team assignment to an active employee', async () => {
    const { service, taskValues } = makeService({
      assignee: [
        {
          id: OTHER_EMPLOYEE_ID,
          fullName: 'Operations Employee',
          email: 'ops@office.local',
          role: 'EMPLOYEE',
          teamId: OTHER_TEAM_ID,
          isActive: true,
        },
      ],
    });

    await service.createTask(
      { title: 'Cross-team task', assignedToId: OTHER_EMPLOYEE_ID },
      currentUser('MANAGER', MANAGER_ID),
    );

    expect(taskValues).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedToId: OTHER_EMPLOYEE_ID,
        teamId: OTHER_TEAM_ID,
      }),
    );
  });

  it('allows self assignment when the creator is an employee', async () => {
    const { service, taskValues } = makeService({
      assignee: [
        {
          id: EMPLOYEE_ID,
          fullName: 'Employee User',
          email: 'employee@office.local',
          role: 'EMPLOYEE',
          teamId: TEAM_ID,
          isActive: true,
        },
      ],
    });

    await service.createTask(
      { title: 'Self task', assignedToId: EMPLOYEE_ID },
      currentUser('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(taskValues).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById: EMPLOYEE_ID,
        assignedToId: EMPLOYEE_ID,
      }),
    );
  });

  it('rejects an inactive assignee', async () => {
    const { service } = makeService({
      assignee: [
        {
          id: EMPLOYEE_ID,
          fullName: 'Inactive Employee',
          email: 'inactive@office.local',
          role: 'EMPLOYEE',
          teamId: TEAM_ID,
          isActive: false,
        },
      ],
    });

    await expect(
      service.createTask(
        { title: 'Invalid task', assignedToId: EMPLOYEE_ID },
        currentUser('ADMIN', ADMIN_ID),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['manager', 'MANAGER'],
    ['admin', 'ADMIN'],
  ] as const)('rejects a %s assignee', async (_, role) => {
    const { service } = makeService({
      assignee: [
        {
          id: MANAGER_ID,
          fullName: 'Ineligible User',
          email: 'ineligible@office.local',
          role,
          teamId: TEAM_ID,
          isActive: true,
        },
      ],
    });

    await expect(
      service.createTask(
        { title: 'Invalid task', assignedToId: MANAGER_ID },
        currentUser('ADMIN', ADMIN_ID),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for a nonexistent assignee', async () => {
    const { service } = makeService({ assignee: [] });

    await expect(
      service.createTask(
        { title: 'Invalid task', assignedToId: EMPLOYEE_ID },
        currentUser('ADMIN', ADMIN_ID),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses safe defaults and never accepts client-controlled creator fields', async () => {
    const { service, taskValues } = makeService();

    await service.createTask(
      {
        title: 'Defaults task',
        assignedToId: EMPLOYEE_ID,
        createdById: ADMIN_ID,
        status: 'DONE',
        completedAt: new Date().toISOString(),
      } as never,
      currentUser('EMPLOYEE', EMPLOYEE_ID),
    );

    expect(taskValues).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById: EMPLOYEE_ID,
        status: 'PENDING',
        priority: 'MEDIUM',
      }),
    );
  });

  it('writes created and assigned activity plus one notification', async () => {
    const { service, activityValues, notificationValues } = makeService();

    await service.createTask(
      { title: 'Audit task', assignedToId: EMPLOYEE_ID },
      currentUser('MANAGER', MANAGER_ID),
    );

    expect(activityValues).toHaveBeenCalledWith([
      expect.objectContaining({ taskId: TASK_ID, type: 'CREATED' }),
      expect.objectContaining({ taskId: TASK_ID, type: 'ASSIGNED' }),
    ]);
    expect(notificationValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: EMPLOYEE_ID,
        taskId: TASK_ID,
        type: 'TASK_ASSIGNED',
      }),
    );
  });

  it('rolls back and returns a generic error when the transaction fails', async () => {
    const { service } = makeService({
      taskInsertError: new Error('simulated database failure'),
    });

    await expect(
      service.createTask(
        { title: 'Rollback task', assignedToId: EMPLOYEE_ID },
        currentUser('ADMIN', ADMIN_ID),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('validates that deadlines include a timezone', async () => {
    const { service } = makeService();

    await expect(
      service.createTask(
        {
          title: 'Timezone task',
          assignedToId: EMPLOYEE_ID,
          deadline: '2026-02-01T12:00:00',
        },
        currentUser('ADMIN', ADMIN_ID),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists tasks with bounded pagination and a stable result shape', async () => {
    const { service, db } = makeService();
    const rows = [responseRow()];
    vi.spyOn(service as never, 'selectTaskRows' as never).mockResolvedValue(
      rows,
    );
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    });

    const result = await service.listTasks({ page: 2, limit: 2, search: 'test' });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(result.data[0]).not.toHaveProperty('passwordHash');
  });

  it('applies status, priority, creator, assignee, team and search filters', async () => {
    const { service } = makeService();
    const buildFilters = vi.spyOn(service as never, 'buildTaskFilters' as never);
    vi.spyOn(service as never, 'selectTaskRows' as never).mockResolvedValue([]);
    const db = (service as unknown as { databaseService: { db: { select: ReturnType<typeof vi.fn> } } }).databaseService.db;
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });

    await service.listTasks({
      status: 'WORKING',
      priority: 'HIGH',
      createdById: MANAGER_ID,
      assignedToId: EMPLOYEE_ID,
      teamId: TEAM_ID,
      search: 'test',
    });

    expect(buildFilters).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'WORKING', priority: 'HIGH' }),
    );
  });

  it('forces /tasks/my to the authenticated identity', async () => {
    const { service } = makeService();
    const buildFilters = vi.spyOn(service as never, 'buildTaskFilters' as never);
    vi.spyOn(service as never, 'selectTaskRows' as never).mockResolvedValue([]);
    const db = (service as unknown as { databaseService: { db: { select: ReturnType<typeof vi.fn> } } }).databaseService.db;
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });

    await service.listMyTasks({}, EMPLOYEE_ID);

    expect(buildFilters).toHaveBeenCalledWith({}, EMPLOYEE_ID);
  });

  it('rejects an impersonation filter on /tasks/my', async () => {
    const { service } = makeService();

    await expect(
      service.listMyTasks({ assignedToId: OTHER_EMPLOYEE_ID }, EMPLOYEE_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns sanitized task details', async () => {
    const { service } = makeService();
    restoreGetTaskById(service);
    vi.spyOn(service as never, 'selectTaskRows' as never).mockResolvedValue([
      responseRow(),
    ]);

    const result = await service.getTaskById(TASK_ID);

    expect(result.creator).toEqual(
      expect.objectContaining({ id: MANAGER_ID, role: 'MANAGER' }),
    );
    expect(result.assignee).toEqual(
      expect.objectContaining({ id: EMPLOYEE_ID, role: 'EMPLOYEE' }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns not found for a missing task detail', async () => {
    const { service } = makeService();
    restoreGetTaskById(service);
    vi.spyOn(service as never, 'selectTaskRows' as never).mockResolvedValue([]);

    await expect(service.getTaskById(TASK_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uses an explicit priority and deadline when supplied', async () => {
    const { service, taskValues } = makeService();
    const deadline = '2026-02-01T12:00:00+06:00';

    await service.createTask(
      {
        title: 'Priority task',
        assignedToId: EMPLOYEE_ID,
        priority: 'URGENT',
        deadline,
      },
      currentUser('ADMIN', ADMIN_ID),
    );

    expect(taskValues).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'URGENT',
        deadline: new Date(deadline),
      }),
    );
  });
});
