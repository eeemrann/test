import { RealtimeNotificationsService } from './realtime-notifications.service.js';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const NOTIFICATION_ID = '77777777-7777-4777-8777-777777777777';

function notification() {
  return {
    id: NOTIFICATION_ID,
    recipientUserId: USER_ID,
    taskId: null,
    type: 'TASK_ASSIGNED' as const,
    title: 'Task assigned',
    message: 'A task was assigned.',
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function makeService(count = 2) {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count }]),
      }),
    }),
  };
  const service = new RealtimeNotificationsService({ db } as never);
  service.setServer({ to } as never);

  return { service, db, to, emit };
}

describe('RealtimeNotificationsService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits a sanitized new notification and database unread count to one room', async () => {
    const { service, to, emit } = makeService(3);

    await service.publishNewNotification({
      ...notification(),
      passwordHash: 'must-not-leak',
    } as never);

    expect(to).toHaveBeenCalledWith(`user:${USER_ID}`);
    expect(emit).toHaveBeenNthCalledWith(
      1,
      'notification:new',
      {
        id: NOTIFICATION_ID,
        type: 'TASK_ASSIGNED',
        title: 'Task assigned',
        message: 'A task was assigned.',
        taskId: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        readAt: null,
      },
    );
    expect(emit).toHaveBeenNthCalledWith(
      2,
      'notifications:unread-count',
      { count: 3 },
    );
    expect(emit.mock.calls[0]?.[1]).not.toHaveProperty('passwordHash');
  });

  it('synchronizes read and read-all events only to the owner room', async () => {
    const { service, emit } = makeService(1);

    await service.publishNotificationRead(USER_ID, {
      id: NOTIFICATION_ID,
      readAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await service.publishNotificationsReadAll(USER_ID, 1);

    expect(emit).toHaveBeenCalledWith(
      'notification:read',
      expect.objectContaining({ id: NOTIFICATION_ID }),
    );
    expect(emit).toHaveBeenCalledWith(
      'notifications:read-all',
      { updatedCount: 1 },
    );
    expect(emit).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: 'another-user' }),
    );
  });

  it('does not fail task or read operations when no sockets are connected', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      }),
    };
    const service = new RealtimeNotificationsService({ db } as never);

    await expect(service.publishNewNotification(notification())).resolves
      .toBeUndefined();
  });

  it('hides database unread-count errors and never exposes their details', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('database secret')),
        }),
      }),
    };
    const service = new RealtimeNotificationsService({ db } as never);

    await expect(service.publishUnreadCount(USER_ID)).resolves.toBeUndefined();
  });
});
