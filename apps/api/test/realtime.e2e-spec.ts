import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { eq, inArray } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import type { Server } from 'socket.io';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { notifications, taskActivities, tasks, users } from '../src/database/schema.js';
import { NotificationsGateway } from '../src/realtime/notifications.gateway.js';
import { e2eAccountEmails, testPassword } from './e2e/accounts.js';

const FIXTURE_PREFIX = `phase-6-2-${Date.now()}`;

function password(key: string): string {
  return testPassword(key);
}

describe('Secure realtime notifications (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let baseUrl: string;
  let employee: { accessToken: string; userId: string };
  let operationsEmployee: { accessToken: string; userId: string };
  let manager: { accessToken: string; userId: string };
  let admin: { accessToken: string; userId: string };
  let realtimeUserId: string;
  let inactiveUserId: string;
  const sockets: Socket[] = [];
  const createdTaskIds: string[] = [];
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

  function connect(token: string, origin = 'http://localhost:5173') {
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { Origin: origin },
    });
    sockets.push(socket);

    return new Promise<Socket>((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', (error) => {
        socket.close();
        reject(error);
      });
    });
  }

  async function expectRejectedConnection(
    token: string | undefined,
    origin = 'http://localhost:5173',
  ): Promise<void> {
    const socket = io(baseUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { Origin: origin },
    });

    await new Promise<void>((resolve, reject) => {
      socket.once('connect_error', () => resolve());
      socket.once('connect', () => reject(new Error('connection was accepted')));
    });
    socket.close();
  }

  function nextEvent<T>(socket: Socket, event: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, onEvent);
        reject(new Error(`Timed out waiting for ${event}`));
      }, 4000);
      const onEvent = (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      };
      socket.once(event, onEvent);
    });
  }

  function noEvent(socket: Socket, event: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        socket.off(event, onEvent);
        resolve(true);
      }, 300);
      const onEvent = () => {
        clearTimeout(timer);
        resolve(false);
      };
      socket.once(event, onEvent);
    });
  }

  async function createTask(token: string, assignedToId: string, suffix: string) {
    const response = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `${FIXTURE_PREFIX}-${suffix}`,
        assignedToId,
      })
      .expect(201);
    createdTaskIds.push(response.body.id as string);
    return response.body as { id: string; assignedToId: string };
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
      e2eAccountEmails.engineeringEmployee,
      'SEED_EMPLOYEE_PASSWORD',
    );
    operationsEmployee = await login(
      e2eAccountEmails.operationsEmployee,
      'SEED_EMPLOYEE_PASSWORD',
    );
    manager = await login(
      e2eAccountEmails.engineeringManager,
      'SEED_MANAGER_PASSWORD',
    );
    admin = await login(e2eAccountEmails.admin, 'SEED_ADMIN_PASSWORD');

    const [realtimeUser] = await database.db
      .insert(users)
      .values({
        fullName: `${FIXTURE_PREFIX} Realtime User`,
        email: `${FIXTURE_PREFIX}@office.local`,
        passwordHash: 'fixture-not-used',
        role: 'EMPLOYEE',
        isActive: true,
      })
      .returning({ id: users.id });
    realtimeUserId = realtimeUser.id;

    const [inactiveUser] = await database.db
      .insert(users)
      .values({
        fullName: `${FIXTURE_PREFIX} Inactive User`,
        email: `${FIXTURE_PREFIX}.inactive@office.local`,
        passwordHash: 'fixture-not-used',
        role: 'EMPLOYEE',
        isActive: false,
      })
      .returning({ id: users.id });
    inactiveUserId = inactiveUser.id;

    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  it('authenticates sockets, enforces origin and disconnects expired access tokens', async () => {
    const valid = await connect(employee.accessToken);
    const jwtService = app.get(JwtService);

    await expectRejectedConnection(undefined);
    await expectRejectedConnection('invalid-token');
    await expectRejectedConnection(
      jwtService.sign({ sub: employee.userId }, { expiresIn: -1 }),
    );
    await expectRejectedConnection(
      jwtService.sign({ sub: inactiveUserId }),
    );
    await expectRejectedConnection(employee.accessToken, 'https://evil.example');

    const expiring = await connect(
      jwtService.sign({ sub: employee.userId }, { expiresIn: 1 }),
    );
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('socket did not expire')), 3000);
      expiring.once('disconnect', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    const gateway = app.get(NotificationsGateway) as NotificationsGateway & {
      server: Server;
    };
    const serverSocket = [...gateway.server.sockets.sockets.values()].find(
      (socket) => socket.data.user?.id === employee.userId,
    );
    expect(serverSocket).toBeDefined();
    valid.emit('join-room', { room: `user:${admin.userId}` });
    await new Promise((resolve) => setImmediate(resolve));
    expect(serverSocket?.rooms.has(`user:${admin.userId}`)).toBe(false);
    expect(serverSocket?.rooms.has(`user:${employee.userId}`)).toBe(true);

    const adminSocket = await connect(admin.accessToken);
    const forgedEvent = noEvent(adminSocket, 'notification:new');
    valid.emit('notification:new', {
      id: 'forged',
      recipientUserId: admin.userId,
      message: 'forged',
    });
    expect(await forgedEvent).toBe(true);
  });

  it('delivers task-creation notifications to multiple recipient connections only', async () => {
    const employeeSocketA = await connect(employee.accessToken);
    const employeeSocketB = await connect(employee.accessToken);
    const managerSocket = await connect(manager.accessToken);
    const adminSocket = await connect(admin.accessToken);
    const beforeCount = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    const employeeEventA = nextEvent<Record<string, unknown>>(
      employeeSocketA,
      'notification:new',
    );
    const employeeEventB = nextEvent<Record<string, unknown>>(
      employeeSocketB,
      'notification:new',
    );
    const countEvent = nextEvent<{ count: number }>(
      employeeSocketA,
      'notifications:unread-count',
    );
    const unrelatedManagerEvent = noEvent(managerSocket, 'notification:new');
    const unrelatedAdminEvent = noEvent(adminSocket, 'notification:new');

    const task = await createTask(
      manager.accessToken,
      employee.userId,
      'creation',
    );
    const [eventA, eventB, count, managerReceived, adminReceived] =
      await Promise.all([
        employeeEventA,
        employeeEventB,
        countEvent,
        unrelatedManagerEvent,
        unrelatedAdminEvent,
      ]);

    expect(eventA).toEqual(eventB);
    expect(Object.keys(eventA).sort()).toEqual([
      'createdAt',
      'id',
      'message',
      'readAt',
      'taskId',
      'title',
      'type',
    ]);
    expect(eventA).toMatchObject({
      type: 'TASK_ASSIGNED',
      taskId: task.id,
      readAt: null,
    });
    expect(eventA).not.toHaveProperty('accessToken');
    expect(eventA).not.toHaveProperty('passwordHash');
    expect(count.count).toBe(beforeCount.body.count + 1);
    expect(managerReceived).toBe(true);
    expect(adminReceived).toBe(true);

    const rows = await database.db
      .select({
        id: notifications.id,
        recipientUserId: notifications.recipientUserId,
        type: notifications.type,
      })
      .from(notifications)
      .where(eq(notifications.taskId, task.id));
    expect(rows).toEqual([
      expect.objectContaining({
        recipientUserId: employee.userId,
        type: 'TASK_ASSIGNED',
      }),
    ]);
    fixtureNotificationIds.push(rows[0].id);
  });

  it('synchronizes mark-read across tabs without emitting duplicate no-op reads', async () => {
    const employeeSocketA = await connect(employee.accessToken);
    const employeeSocketB = await connect(employee.accessToken);
    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .query({ limit: 100 })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    const notification = notificationsResponse.body.data.find(
      (item: { taskId: string | null }) => item.taskId === createdTaskIds[0],
    );
    expect(notification).toBeDefined();

    const readA = nextEvent<{ id: string; readAt: string }>(
      employeeSocketA,
      'notification:read',
    );
    const readB = nextEvent<{ id: string; readAt: string }>(
      employeeSocketB,
      'notification:read',
    );
    const count = nextEvent<{ count: number }>(
      employeeSocketA,
      'notifications:unread-count',
    );
    const response = await request(app.getHttpServer())
      .patch(`/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    const [readEventA, readEventB, countEvent] = await Promise.all([
      readA,
      readB,
      count,
    ]);
    expect(response.body.readAt).toBe(readEventA.readAt);
    expect(readEventA).toEqual(readEventB);
    expect(countEvent.count).toBe(
      (await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${employee.accessToken}`)
        .expect(200)).body.count,
    );

    const noDuplicateRead = noEvent(employeeSocketA, 'notification:read');
    await request(app.getHttpServer())
      .patch(`/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(await noDuplicateRead).toBe(true);
  });

  it('synchronizes mark-all across tabs for a clean authenticated user', async () => {
    const token = app.get(JwtService).sign({ sub: realtimeUserId });
    const socketA = await connect(token);
    const socketB = await connect(token);
    const [fixtureNotification] = await database.db
      .insert(notifications)
      .values({
        recipientUserId: realtimeUserId,
        type: 'TASK_UPDATED',
        title: `${FIXTURE_PREFIX}-read-all`,
        message: 'Read-all fixture.',
      })
      .returning({ id: notifications.id });
    fixtureNotificationIds.push(fixtureNotification.id);

    const readAllA = nextEvent<{ updatedCount: number }>(
      socketA,
      'notifications:read-all',
    );
    const readAllB = nextEvent<{ updatedCount: number }>(
      socketB,
      'notifications:read-all',
    );
    const count = nextEvent<{ count: number }>(
      socketA,
      'notifications:unread-count',
    );
    const response = await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const [eventA, eventB, countEvent] = await Promise.all([
      readAllA,
      readAllB,
      count,
    ]);
    expect(response.body).toEqual({ updatedCount: 1 });
    expect(eventA).toEqual(eventB);
    expect(eventA).toEqual({ updatedCount: 1 });
    expect(countEvent).toEqual({ count: 0 });
  });

  it('publishes status, edit, and reassignment notifications after commit', async () => {
    const employeeSocket = await connect(employee.accessToken);
    const operationsSocket = await connect(operationsEmployee.accessToken);
    const managerSocket = await connect(manager.accessToken);

    const statusCreationEvent = nextEvent(employeeSocket, 'notification:new');
    const statusTask = await createTask(
      manager.accessToken,
      employee.userId,
      'status',
    );
    await statusCreationEvent;
    const statusEvent = nextEvent<Record<string, unknown>>(
      managerSocket,
      'notification:new',
    );
    await request(app.getHttpServer())
      .patch(`/tasks/${statusTask.id}/status`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(200);
    expect(await statusEvent).toMatchObject({
      type: 'TASK_STATUS_CHANGED',
      taskId: statusTask.id,
    });

    const editEvent = nextEvent<Record<string, unknown>>(
      employeeSocket,
      'notification:new',
    );
    await request(app.getHttpServer())
      .patch(`/tasks/${statusTask.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ title: `${FIXTURE_PREFIX}-edited` })
      .expect(200);
    expect(await editEvent).toMatchObject({
      type: 'TASK_UPDATED',
      taskId: statusTask.id,
    });

    const reassignmentCreationEvent = nextEvent(
      employeeSocket,
      'notification:new',
    );
    const reassignmentTask = await createTask(
      admin.accessToken,
      employee.userId,
      'reassignment',
    );
    await reassignmentCreationEvent;
    const reassignmentEvent = nextEvent<Record<string, unknown>>(
      operationsSocket,
      'notification:new',
    );
    const noEmployeeReassignment = noEvent(employeeSocket, 'notification:new');
    await request(app.getHttpServer())
      .patch(`/tasks/${reassignmentTask.id}/assign`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ assignedToId: operationsEmployee.userId })
      .expect(200);
    expect(await reassignmentEvent).toMatchObject({
      type: 'TASK_REASSIGNED',
      taskId: reassignmentTask.id,
    });
    expect(await noEmployeeReassignment).toBe(true);

    const noOpEvent = noEvent(operationsSocket, 'notification:new');
    await request(app.getHttpServer())
      .patch(`/tasks/${reassignmentTask.id}/assign`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ assignedToId: operationsEmployee.userId })
      .expect(200);
    expect(await noOpEvent).toBe(true);

    const noFailedTransactionEvent = noEvent(employeeSocket, 'notification:new');
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: `${FIXTURE_PREFIX}-invalid`,
        assignedToId: manager.userId,
      })
      .expect(400);
    expect(await noFailedTransactionEvent).toBe(true);

    const reassignmentRows = await database.db
      .select({ type: notifications.type })
      .from(notifications)
      .where(eq(notifications.taskId, reassignmentTask.id));
    expect(reassignmentRows.map((row) => row.type)).toEqual([
      'TASK_ASSIGNED',
      'TASK_REASSIGNED',
    ]);
  });

  it('keeps offline notifications in REST and accepts reconnection with a fresh token', async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }
    sockets.length = 0;

    const offlineTask = await createTask(
      manager.accessToken,
      employee.userId,
      'offline',
    );
    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .query({ limit: 100 })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(
      notificationsResponse.body.data.some(
        (item: { taskId: string | null }) => item.taskId === offlineTask.id,
      ),
    ).toBe(true);

    const freshLogin = await login(
      e2eAccountEmails.engineeringEmployee,
      'SEED_EMPLOYEE_PASSWORD',
    );
    const reconnected = await connect(freshLogin.accessToken);
    expect(reconnected.connected).toBe(true);
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }

    if (createdTaskIds.length > 0 && database) {
      await database.db
        .delete(notifications)
        .where(inArray(notifications.taskId, createdTaskIds));
      await database.db
        .delete(taskActivities)
        .where(inArray(taskActivities.taskId, createdTaskIds));
      await database.db
        .delete(tasks)
        .where(inArray(tasks.id, createdTaskIds));
    }

    if (fixtureNotificationIds.length > 0 && database) {
      await database.db
        .delete(notifications)
        .where(inArray(notifications.id, fixtureNotificationIds));
    }

    if (realtimeUserId && database) {
      await database.db.delete(users).where(eq(users.id, realtimeUserId));
    }
    if (inactiveUserId && database) {
      await database.db.delete(users).where(eq(users.id, inactiveUserId));
    }

    if (app) {
      await app.close();
    }
  });
});
