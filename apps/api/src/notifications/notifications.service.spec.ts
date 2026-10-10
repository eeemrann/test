import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotificationQueryDto } from './dto/notification-query.dto.js';
import { NotificationsService } from './notifications.service.js';

const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const NOTIFICATION_ID = '77777777-7777-4777-8777-777777777777';
const TASK_ID = '88888888-8888-4888-8888-888888888888';

function notificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    type: 'TASK_ASSIGNED' as const,
    title: 'Task assigned',
    message: 'A new task has been assigned to you.',
    taskId: TASK_ID,
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeListService(rows: unknown[], total: number) {
  const countQuery = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count: total }]),
    }),
  };
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockReturnValue({ offset });
  const orderBy = vi.fn().mockReturnValue({ limit });
  const rowQuery = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ orderBy }),
    }),
  };
  const db = {
    select: vi
      .fn()
      .mockReturnValueOnce(countQuery)
      .mockReturnValueOnce(rowQuery),
  };

  return {
    service: new NotificationsService({ db } as never),
    db,
    orderBy,
    limit,
    offset,
  };
}

function makeCountService(result: unknown[]) {
  const where = vi.fn().mockResolvedValue(result);
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where }),
    }),
  };

  return { service: new NotificationsService({ db } as never), db, where };
}

function makeUpdateService(
  result: unknown[],
  error?: Error,
  existing: unknown[] = [],
) {
  const returning = error
    ? vi.fn().mockRejectedValue(error)
    : vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const db = {
    update,
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(existing),
        }),
      }),
    }),
  };

  return {
    service: new NotificationsService({ db } as never),
    db,
    update,
    set,
    where,
    returning,
  };
}

describe('NotificationsService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists only the authenticated user inbox with stable pagination', async () => {
    const rows = [
      notificationRow(),
      notificationRow({
        id: '99999999-9999-4999-8999-999999999999',
        readAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ];
    const { service, orderBy, limit, offset } = makeListService(rows, 5);

    const result = await service.listNotifications(
      { page: 2, limit: 2 } as NotificationQueryDto,
      EMPLOYEE_ID,
    );

    expect(result).toEqual({
      data: rows,
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(orderBy.mock.calls[0]).toHaveLength(2);
    expect(limit).toHaveBeenCalledWith(2);
    expect(offset).toHaveBeenCalledWith(2);
    expect(result.data[0]).not.toHaveProperty('passwordHash');
  });

  it('returns an empty inbox with zero pages', async () => {
    const { service } = makeListService([], 0);

    await expect(
      service.listNotifications({}, EMPLOYEE_ID),
    ).resolves.toEqual({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('supports the bounded maximum page size and unread-only mode', async () => {
    const { service, limit } = makeListService(
      [notificationRow()],
      1,
    );

    await service.listNotifications(
      { page: 1, limit: 100, unreadOnly: true } as NotificationQueryDto,
      EMPLOYEE_ID,
    );

    expect(limit).toHaveBeenCalledWith(100);
  });

  it('rejects invalid notification query parameters', async () => {
    const invalid = plainToInstance(NotificationQueryDto, {
      limit: '101',
      unreadOnly: 'not-a-boolean',
    });
    const errors = await validate(invalid);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['limit', 'unreadOnly']),
    );
  });

  it('returns unread counts through a database aggregate', async () => {
    const { service, db } = makeCountService([{ count: 5 }]);

    await expect(service.getUnreadCount(EMPLOYEE_ID)).resolves.toEqual({
      count: 5,
    });
    expect(db.select).toHaveBeenCalledOnce();
  });

  it('returns zero when there are no unread notifications', async () => {
    const { service } = makeCountService([{ count: 0 }]);

    await expect(service.getUnreadCount(EMPLOYEE_ID)).resolves.toEqual({
      count: 0,
    });
  });

  it('marks an owned unread notification as read', async () => {
    const updated = notificationRow({
      readAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    const { service, update, set } = makeUpdateService([updated]);

    await expect(
      service.markAsRead(NOTIFICATION_ID, EMPLOYEE_ID),
    ).resolves.toEqual(updated);
    expect(update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({ readAt: expect.anything() });
  });

  it('preserves readAt when marking an already-read notification again', async () => {
    const readAt = new Date('2026-01-03T00:00:00.000Z');
    const { service } = makeUpdateService([], undefined, [
      notificationRow({ readAt }),
    ]);

    const result = await service.markAsRead(NOTIFICATION_ID, EMPLOYEE_ID);

    expect(result.readAt).toBe(readAt);
  });

  it.each([
    ['missing', []],
    ['another user', []],
  ])('returns 404 for a %s notification', async (_, result) => {
    const { service } = makeUpdateService(result);

    await expect(
      service.markAsRead(NOTIFICATION_ID, ADMIN_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides unexpected read errors behind a safe 500', async () => {
    const { service } = makeUpdateService([], new Error('database secret'));

    await expect(
      service.markAsRead(NOTIFICATION_ID, EMPLOYEE_ID),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(
      service.markAsRead(NOTIFICATION_ID, EMPLOYEE_ID),
    ).rejects.not.toThrow('database secret');
  });

  it('marks only current-user unread notifications and reports the count', async () => {
    const { service, update, where } = makeUpdateService([
      { id: NOTIFICATION_ID },
      { id: '99999999-9999-4999-8999-999999999999' },
    ]);

    await expect(service.markAllAsRead(EMPLOYEE_ID)).resolves.toEqual({
      updatedCount: 2,
    });
    expect(update).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledOnce();
  });

  it('returns zero for a repeated mark-all operation', async () => {
    const { service } = makeUpdateService([]);

    await expect(service.markAllAsRead(EMPLOYEE_ID)).resolves.toEqual({
      updatedCount: 0,
    });
  });

  it('maps database failures to a safe notification error', async () => {
    const { service } = makeCountService([]);
    (service as unknown as { databaseService: { db: unknown } }).databaseService = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error('contains secret')),
          }),
        }),
      },
    };

    await expect(service.getUnreadCount(EMPLOYEE_ID)).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          message: 'Notification operation failed',
        }),
      }),
    );
  });

  it('accepts a valid default query', async () => {
    const valid = plainToInstance(NotificationQueryDto, {
      page: '1',
      limit: '100',
      unreadOnly: 'true',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
  });
});
