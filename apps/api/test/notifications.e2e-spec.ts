import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { notifications } from '../src/database/schema.js';

const FIXTURE_TITLE = `phase-6-1-${Date.now()}`;

function password(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is required for notification e2e tests`);
  }

  return value;
}

describe('Notifications inbox APIs (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let employee: { accessToken: string; userId: string };
  let manager: { accessToken: string; userId: string };
  let admin: { accessToken: string; userId: string };
  const fixtureNotificationIds: string[] = [];

  async function login(email: string, passwordKey: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: password(passwordKey) })
      .expect(201);

    return {
      accessToken: response.body.accessToken as string,
      userId: response.body.user.id as string,
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    database = app.get(DatabaseService);

    employee = await login(
      'eng.employee@office.local',
      'SEED_EMPLOYEE_PASSWORD',
    );
    manager = await login(
      'eng.manager@office.local',
      'SEED_MANAGER_PASSWORD',
    );
    admin = await login('admin@office.local', 'SEED_ADMIN_PASSWORD');

    const fixtureRows = await database.db
      .insert(notifications)
      .values([
        {
          recipientUserId: employee.userId,
          type: 'TASK_ASSIGNED',
          title: `${FIXTURE_TITLE}-employee-unread-1`,
          message: 'Fixture notification one.',
        },
        {
          recipientUserId: employee.userId,
          type: 'TASK_UPDATED',
          title: `${FIXTURE_TITLE}-employee-unread-2`,
          message: 'Fixture notification two.',
        },
        {
          recipientUserId: employee.userId,
          type: 'TASK_STATUS_CHANGED',
          title: `${FIXTURE_TITLE}-employee-read`,
          message: 'Fixture notification three.',
          readAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          recipientUserId: manager.userId,
          type: 'TASK_REASSIGNED',
          title: `${FIXTURE_TITLE}-manager-unread`,
          message: 'Fixture manager notification.',
        },
      ])
      .returning({ id: notifications.id });

    fixtureNotificationIds.push(...fixtureRows.map((row) => row.id));
  });

  it('requires authentication for every notification endpoint', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .expect(401);
    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/notifications/${fixtureNotificationIds[0]}/read`)
      .expect(401);
  });

  it('lists only the current user notifications with pagination and safe fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/notifications')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);

    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(response.body.data).toHaveLength(2);
    expect(Object.keys(response.body.data[0]).sort()).toEqual([
      'createdAt',
      'id',
      'message',
      'readAt',
      'taskId',
      'title',
      'type',
    ]);
    expect(response.body.data[0]).not.toHaveProperty('passwordHash');
    expect(response.body.data[0]).not.toHaveProperty('recipientUserId');

    const unread = await request(app.getHttpServer())
      .get('/notifications')
      .query({ unreadOnly: true, limit: 100 })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(unread.body.pagination.total).toBe(2);
    expect(unread.body.data.every((item: { readAt: Date | null }) =>
      item.readAt === null,
    )).toBe(true);

    await request(app.getHttpServer())
      .get('/notifications')
      .query({ limit: 101 })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/notifications')
      .query({ unreadOnly: 'not-a-boolean' })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(400);
  });

  it('returns unread counts for each authenticated user', async () => {
    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200)
      .expect({ count: 2 });
    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200)
      .expect({ count: 1 });
    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect({ count: 0 });
  });

  it('marks one owned notification as read idempotently', async () => {
    const notificationId = fixtureNotificationIds[0];
    const first = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);

    expect(first.body).toMatchObject({ id: notificationId, readAt: expect.any(String) });
    const readAt = first.body.readAt;

    const second = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(second.body.readAt).toBe(readAt);

    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200)
      .expect({ count: 1 });
  });

  it('does not expose or modify another user notification', async () => {
    const notificationId = fixtureNotificationIds[1];

    await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.pagination.total).toBe(1);
        expect(body.data[0].id).toBe(fixtureNotificationIds[3]);
      });
  });

  it('marks all current-user unread notifications and is safe to repeat', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200)
      .expect({ updatedCount: 1 });
    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200)
      .expect({ updatedCount: 0 });
    await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200)
      .expect({ count: 0 });

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200)
      .expect({ updatedCount: 1 });
  });

  it('validates IDs and hides missing or unauthorized notifications', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/not-a-uuid/read')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .patch('/notifications/88888888-8888-4888-8888-888888888888/read')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(404);
  });

  afterAll(async () => {
    if (fixtureNotificationIds.length > 0 && database) {
      await database.db
        .delete(notifications)
        .where(inArray(notifications.id, fixtureNotificationIds));
    }

    if (app) {
      await app.close();
    }
  });
});
