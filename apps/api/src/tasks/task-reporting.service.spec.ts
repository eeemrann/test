import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { TaskActivityQueryDto } from './dto/task-activity-query.dto.js';
import type { TaskSummaryQueryDto } from './dto/task-summary-query.dto.js';
import { TasksService } from './tasks.service.js';

const TASK_ID = '77777777-7777-4777-8777-777777777777';
const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';
const TEAM_ID = '55555555-5555-4555-8555-555555555555';

function activityRow(overrides: Record<string, unknown> = {}) {
  return {
    activityId: '88888888-8888-4888-8888-888888888888',
    type: 'STATUS_CHANGED',
    metadata: {
      previousStatus: 'PENDING',
      newStatus: 'WORKING',
      actorUserId: EMPLOYEE_ID,
      changedAt: '2026-01-01T00:00:00.000Z',
      passwordHash: 'must-not-leak',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    actorId: EMPLOYEE_ID,
    actorFullName: 'Employee User',
    actorEmail: 'employee@office.local',
    actorRole: 'EMPLOYEE',
    actorTeamId: TEAM_ID,
    ...overrides,
  };
}

function historyQuery(rows: unknown[], total: number, taskExists = true) {
  const existenceQuery = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(taskExists ? [{ id: TASK_ID }] : []),
      }),
    }),
  };
  const countQuery = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count: total }]),
    }),
  };
  const activityQuery = {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      }),
    }),
  };
  const db = {
    select: vi
      .fn()
      .mockReturnValueOnce(existenceQuery)
      .mockReturnValueOnce(countQuery)
      .mockReturnValueOnce(activityQuery),
  };

  return { db };
}

function summaryQuery(summary: Record<string, number>) {
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([summary]),
      }),
    }),
  };

  return { db };
}

describe('TasksService reporting', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns newest task activities with sanitized actors and metadata', async () => {
    const { db } = historyQuery([
      activityRow(),
      activityRow({
        activityId: '99999999-9999-4999-8999-999999999999',
        type: 'CREATED',
        metadata: { passwordHash: 'must-not-leak' },
      }),
    ], 2);
    const service = new TasksService({ db } as never);

    const result = await service.listTaskActivities(TASK_ID, {
      page: 1,
      limit: 2,
    } as TaskActivityQueryDto);

    expect(result.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 2,
      totalPages: 1,
    });
    expect(result.data[0]).toMatchObject({
      id: '88888888-8888-4888-8888-888888888888',
      type: 'STATUS_CHANGED',
      actor: {
        id: EMPLOYEE_ID,
        fullName: 'Employee User',
        email: 'employee@office.local',
        role: 'EMPLOYEE',
        teamId: TEAM_ID,
      },
      metadata: {
        previousStatus: 'PENDING',
        newStatus: 'WORKING',
        actorUserId: EMPLOYEE_ID,
        changedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(result.data[0]).not.toHaveProperty('passwordHash');
    expect(result.data[1].metadata).toBeNull();
  });

  it('returns an empty paginated history without error', async () => {
    const { db } = historyQuery([], 0);
    const service = new TasksService({ db } as never);

    const result = await service.listTaskActivities(TASK_ID, {
      page: 2,
      limit: 10,
    } as TaskActivityQueryDto);

    expect(result).toEqual({
      data: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('returns not found when task history has no matching task', async () => {
    const { db } = historyQuery([], 0, false);
    const service = new TasksService({ db } as never);

    await expect(
      service.listTaskActivities(TASK_ID, {} as TaskActivityQueryDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns SQL aggregate counts for the all-task summary', async () => {
    const { db } = summaryQuery({
      total: 7,
      pending: 2,
      working: 3,
      done: 2,
      overdue: 1,
    });
    const service = new TasksService({ db } as never);

    await expect(
      service.getTaskSummary({ scope: 'all' } as TaskSummaryQueryDto, EMPLOYEE_ID),
    ).resolves.toEqual({
      total: 7,
      pending: 2,
      working: 3,
      done: 2,
      overdue: 1,
    });
  });

  it('uses the authenticated assignee for mine summaries', async () => {
    const { db } = summaryQuery({
      total: 1,
      pending: 0,
      working: 1,
      done: 0,
      overdue: 0,
    });
    const service = new TasksService({ db } as never);
    const buildFilters = vi.spyOn(
      service as never,
      'buildTaskFilters' as never,
    );

    await service.getTaskSummary(
      { scope: 'mine' } as TaskSummaryQueryDto,
      EMPLOYEE_ID,
    );

    expect(buildFilters).toHaveBeenCalledWith(
      { scope: 'mine' },
      EMPLOYEE_ID,
      expect.any(Date),
    );
  });

  it('rejects a mine summary filtered to another assignee', async () => {
    const { db } = summaryQuery({
      total: 0,
      pending: 0,
      working: 0,
      done: 0,
      overdue: 0,
    });
    const service = new TasksService({ db } as never);

    await expect(
      service.getTaskSummary(
        { scope: 'mine', assignedToId: OTHER_USER_ID } as TaskSummaryQueryDto,
        EMPLOYEE_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reversed deadline ranges and accepts overdue filters', () => {
    const service = new TasksService({} as never);
    const buildFilters = (
      service as unknown as {
        buildTaskFilters: (query: Record<string, unknown>) => unknown;
      }
    ).buildTaskFilters.bind(service);

    expect(() =>
      buildFilters({
        deadlineFrom: '2026-02-01T00:00:00Z',
        deadlineTo: '2026-01-01T00:00:00Z',
      }),
    ).toThrow(BadRequestException);
    expect(
      buildFilters({ overdue: true }),
    ).toBeDefined();
  });
});
