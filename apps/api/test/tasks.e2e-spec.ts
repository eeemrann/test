import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  notifications,
  taskActivities,
  tasks,
} from '../src/database/schema.js';
import { e2eAccountEmails, testPassword } from './e2e/accounts.js';

const DEMO_EMPLOYEE_EMAIL = e2eAccountEmails.engineeringEmployee;
const DEMO_MANAGER_EMAIL = e2eAccountEmails.engineeringManager;
const DEMO_ADMIN_EMAIL = e2eAccountEmails.admin;
const EXPECTED_ACTIVE_EMPLOYEE_COUNT =
  process.env.E2E_ISOLATED_DATABASE === 'true' || process.env.E2E_EMPLOYEE_EMAIL
    ? 4
    : 2;
const TASK_PREFIX = `phase-5-2-${Date.now()}`;

function password(key: string): string {
  return testPassword(key);
}

describe('Taskboard core APIs (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let employee: { accessToken: string; userId: string };
  let operationsEmployee: { accessToken: string; userId: string };
  let manager: { accessToken: string; userId: string };
  let admin: { accessToken: string; userId: string };
  const createdTaskIds: string[] = [];

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

    employee = await login(DEMO_EMPLOYEE_EMAIL, 'SEED_EMPLOYEE_PASSWORD');
    operationsEmployee = await login(
      e2eAccountEmails.operationsEmployee,
      'SEED_EMPLOYEE_PASSWORD',
    );
    manager = await login(DEMO_MANAGER_EMAIL, 'SEED_MANAGER_PASSWORD');
    admin = await login(DEMO_ADMIN_EMAIL, 'SEED_ADMIN_PASSWORD');
  });

  it('requires authentication and rejects forbidden client-controlled fields', async () => {
    await request(app.getHttpServer()).get('/tasks').expect(401);
    await request(app.getHttpServer()).get('/users/assignable').expect(401);

    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({
        title: `${TASK_PREFIX}-invalid`,
        assignedToId: employee.userId,
        createdById: admin.userId,
        status: 'DONE',
        completedAt: new Date().toISOString(),
      })
      .expect(400);
  });

  it('lists active employees across teams without sensitive fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/assignable')
      .query({ search: 'employee', page: 1, limit: 10 })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);

    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: EXPECTED_ACTIVE_EMPLOYEE_COUNT,
    });
    expect(response.body.data).toHaveLength(EXPECTED_ACTIVE_EMPLOYEE_COUNT);
    expect(response.body.data.every((user: Record<string, unknown>) =>
      !('passwordHash' in user) &&
      Object.keys(user).sort().join(',') === 'email,fullName,id,teamId',
    )).toBe(true);
  });

  it('allows employee self-assignment, manager cross-team assignment, and admin creation', async () => {
    const assignable = await request(app.getHttpServer())
      .get('/users/assignable')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const employees = assignable.body.data as Array<{
      id: string;
      email: string;
      teamId: string | null;
    }>;
    const engineeringEmployee = employees.find(
      (user) => user.email === DEMO_EMPLOYEE_EMAIL,
    );
    const operationsEmployee = employees.find(
      (user) => user.email === e2eAccountEmails.operationsEmployee,
    );

    expect(engineeringEmployee).toBeDefined();
    expect(operationsEmployee).toBeDefined();
    expect(engineeringEmployee?.teamId).not.toBe(operationsEmployee?.teamId);

    const selfTask = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({
        title: `${TASK_PREFIX}-self`,
        description: 'Self assignment fixture',
        assignedToId: employee.userId,
      })
      .expect(201);
    const managerTask = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({
        title: `${TASK_PREFIX}-cross-team`,
        priority: 'HIGH',
        assignedToId: operationsEmployee?.id,
      })
      .expect(201);
    const adminTask = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: `${TASK_PREFIX}-admin`,
        assignedToId: engineeringEmployee?.id,
      })
      .expect(201);

    createdTaskIds.push(
      selfTask.body.id,
      managerTask.body.id,
      adminTask.body.id,
    );

    expect(selfTask.body).toMatchObject({
      title: `${TASK_PREFIX}-self`,
      status: 'PENDING',
      priority: 'MEDIUM',
      creator: { id: employee.userId },
      assignee: { id: employee.userId, role: 'EMPLOYEE' },
      teamId: engineeringEmployee?.teamId,
    });
    expect(managerTask.body).toMatchObject({
      priority: 'HIGH',
      creator: { id: manager.userId },
      assignee: { id: operationsEmployee?.id, role: 'EMPLOYEE' },
      teamId: operationsEmployee?.teamId,
    });
    expect(adminTask.body.creator.id).toBe(admin.userId);

    const activityRows = await database.db
      .select({ type: taskActivities.type })
      .from(taskActivities)
      .where(eq(taskActivities.taskId, selfTask.body.id));
    const notificationRows = await database.db
      .select({ type: notifications.type })
      .from(notifications)
      .where(eq(notifications.taskId, selfTask.body.id));

    expect(activityRows.map((row) => row.type).sort()).toEqual([
      'ASSIGNED',
      'CREATED',
    ]);
    expect(notificationRows).toEqual([{ type: 'TASK_ASSIGNED' }]);
  });

  it('supports filtered pagination, identity-scoped my tasks, and task details', async () => {
    const list = await request(app.getHttpServer())
      .get('/tasks')
      .query({ search: TASK_PREFIX.toUpperCase(), status: 'PENDING', limit: 2 })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(list.body.pagination.total).toBe(3);
    expect(list.body.data).toHaveLength(2);

    const myTasks = await request(app.getHttpServer())
      .get('/tasks/my')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(myTasks.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      myTasks.body.data.every(
        (task: { assignee: { id: string } }) =>
          task.assignee.id === employee.userId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get('/tasks/my')
      .query({ assignedToId: manager.userId })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(400);

    const detail = await request(app.getHttpServer())
      .get(`/tasks/${createdTaskIds[0]}`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(detail.body).not.toHaveProperty('passwordHash');
    expect(detail.body.creator).not.toHaveProperty('passwordHash');
    expect(detail.body.assignee).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .get('/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/tasks/88888888-8888-4888-8888-888888888888')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(404);
  });

  it('enforces status transitions, completion timestamps, and status history', async () => {
    const taskId = createdTaskIds[0];

    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .send({ status: 'WORKING' })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ status: 'NOT_A_STATUS' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/tasks/not-a-uuid/status')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ title: 'Invalid id' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/tasks/88888888-8888-4888-8888-888888888888/status')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(404);
    await request(app.getHttpServer())
      .patch('/tasks/88888888-8888-4888-8888-888888888888')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ title: 'Missing task' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(403);

    const started = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(200);
    expect(started.body).toMatchObject({ status: 'WORKING', completedAt: null });

    const completed = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ status: 'DONE' })
      .expect(200);
    expect(completed.body.status).toBe('DONE');
    expect(completed.body.completedAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ status: 'PENDING' })
      .expect(409);

    const reopened = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(200);
    expect(reopened.body).toMatchObject({ status: 'WORKING', completedAt: null });

    const activities = await database.db
      .select({ type: taskActivities.type, metadata: taskActivities.metadata })
      .from(taskActivities)
      .where(eq(taskActivities.taskId, taskId));
    const statusActivities = activities.filter(
      (activity) => activity.type === 'STATUS_CHANGED',
    );
    expect(statusActivities).toHaveLength(3);
    expect(statusActivities[0].metadata).toEqual(
      expect.objectContaining({
        previousStatus: 'PENDING',
        newStatus: 'WORKING',
        actorUserId: employee.userId,
      }),
    );
  });

  it('enforces edit permissions, patch semantics, and update notifications', async () => {
    const employeeTaskId = createdTaskIds[0];
    const managerTaskId = createdTaskIds[1];

    await request(app.getHttpServer())
      .patch(`/tasks/${employeeTaskId}`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ title: 'Blocked while working' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/tasks/${employeeTaskId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: `${TASK_PREFIX}-edited`,
        description: 'Edited safely',
        priority: 'URGENT',
        deadline: '2026-12-31T23:59:00Z',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          title: `${TASK_PREFIX}-edited`,
          description: 'Edited safely',
          priority: 'URGENT',
          status: 'WORKING',
          completedAt: null,
        });
      });

    const managerEdit = await request(app.getHttpServer())
      .patch(`/tasks/${managerTaskId}`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ priority: 'LOW' });
    expect(managerEdit.status).toBe(200);
    await request(app.getHttpServer())
      .patch(`/tasks/${managerTaskId}`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ createdById: employee.userId })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/tasks/${managerTaskId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/tasks/${managerTaskId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ deadline: '2026-12-31T23:59:00' })
      .expect(400);

    const detail = await request(app.getHttpServer())
      .get(`/tasks/${employeeTaskId}`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(detail.body).toMatchObject({
      title: `${TASK_PREFIX}-edited`,
      description: 'Edited safely',
      priority: 'URGENT',
    });
    expect(detail.body).not.toHaveProperty('passwordHash');

    const activities = await database.db
      .select({ type: taskActivities.type, metadata: taskActivities.metadata })
      .from(taskActivities)
      .where(eq(taskActivities.taskId, employeeTaskId));
    expect(activities.filter((activity) => activity.type === 'UPDATED')).toEqual(
      [
        expect.objectContaining({
          type: 'UPDATED',
          metadata: expect.objectContaining({
            changes: expect.objectContaining({
              title: expect.any(Object),
              description: expect.any(Object),
              priority: expect.any(Object),
              deadline: expect.any(Object),
            }),
          }),
        }),
      ],
    );

    const notificationRows = await database.db
      .select({ type: notifications.type })
      .from(notifications)
      .where(eq(notifications.taskId, employeeTaskId));
    expect(notificationRows.map((notification) => notification.type).sort()).toEqual([
      'TASK_ASSIGNED',
      'TASK_STATUS_CHANGED',
      'TASK_UPDATED',
    ]);
  });

  it('supports activity history, advanced deadline filters, and summaries', async () => {
    const employeeTaskId = createdTaskIds[0];
    const managerTaskId = createdTaskIds[1];

    await request(app.getHttpServer())
      .patch(`/tasks/${managerTaskId}`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ deadline: '2020-01-01T00:00:00Z' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/tasks/summary')
      .expect(401);
    await request(app.getHttpServer())
      .get('/tasks/summary')
      .query({ scope: 'all', search: TASK_PREFIX })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          total: 3,
          pending: 2,
          working: 1,
          done: 0,
          overdue: 1,
        });
      });

    await request(app.getHttpServer())
      .get('/tasks/summary')
      .query({ scope: 'mine', search: TASK_PREFIX })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          total: 2,
          pending: 1,
          working: 1,
          done: 0,
          overdue: 0,
        });
      });
    await request(app.getHttpServer())
      .get('/tasks/summary')
      .query({ scope: 'mine', assignedToId: manager.userId })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(400);

    const overdue = await request(app.getHttpServer())
      .get('/tasks')
      .query({ overdue: true, search: TASK_PREFIX })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(overdue.body.data.map((task: { id: string }) => task.id)).toEqual([
      managerTaskId,
    ]);

    const deadlineSorted = await request(app.getHttpServer())
      .get('/tasks')
      .query({
        deadlineFrom: '2019-01-01T00:00:00Z',
        deadlineTo: '2021-01-01T00:00:00Z',
        sortBy: 'deadline',
        sortOrder: 'asc',
        search: TASK_PREFIX,
      })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(deadlineSorted.body.data).toHaveLength(1);
    expect(deadlineSorted.body.data[0].id).toBe(managerTaskId);

    await request(app.getHttpServer())
      .get('/tasks')
      .query({ deadlineFrom: '2021-01-01T00:00:00', search: TASK_PREFIX })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/tasks')
      .query({
        deadlineFrom: '2026-02-01T00:00:00Z',
        deadlineTo: '2026-01-01T00:00:00Z',
        search: TASK_PREFIX,
      })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/tasks')
      .query({ sortBy: 'title', search: TASK_PREFIX })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get(`/tasks/${employeeTaskId}/activities`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/tasks/not-a-uuid/activities')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/tasks/88888888-8888-4888-8888-888888888888/activities')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(404);

    const history = await request(app.getHttpServer())
      .get(`/tasks/${employeeTaskId}/activities`)
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(history.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 6,
    });
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data.every((activity: Record<string, unknown>) =>
      !('passwordHash' in activity) &&
      !('passwordHash' in (activity.actor as Record<string, unknown>)),
    )).toBe(true);
  });

  it('enforces manager scope and supports admin cross-team reassignment', async () => {
    const taskId = createdTaskIds[2];

    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ assignedToId: operationsEmployee.userId })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ assignedToId: operationsEmployee.userId })
      .expect(403);

    const reassigned = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ assignedToId: operationsEmployee.userId })
      .expect(200);
    expect(reassigned.body).toMatchObject({
      creator: { id: admin.userId },
      assignee: { id: operationsEmployee.userId, role: 'EMPLOYEE' },
      status: 'PENDING',
      completedAt: null,
    });
    expect(reassigned.body.teamId).toBe(
      reassigned.body.assignee.teamId,
    );

    const afterReassignment = await request(app.getHttpServer())
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const updatedAt = afterReassignment.body.updatedAt as string;

    const operationsTasks = await request(app.getHttpServer())
      .get('/tasks/my')
      .set('Authorization', `Bearer ${operationsEmployee.accessToken}`)
      .expect(200);
    expect(
      operationsTasks.body.data.some(
        (task: { id: string }) => task.id === taskId,
      ),
    ).toBe(true);

    const engineeringTasks = await request(app.getHttpServer())
      .get('/tasks/my')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(
      engineeringTasks.body.data.some(
        (task: { id: string }) => task.id === taskId,
      ),
    ).toBe(false);

    const beforeNoOpActivityCount = await database.db
      .select({ id: taskActivities.id })
      .from(taskActivities)
      .where(eq(taskActivities.taskId, taskId));
    const beforeNoOpNotificationCount = await database.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.taskId, taskId));

    const noOp = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ assignedToId: operationsEmployee.userId })
      .expect(200);
    expect(noOp.body.updatedAt).toBe(updatedAt);

    const afterNoOpActivityCount = await database.db
      .select({ id: taskActivities.id })
      .from(taskActivities)
      .where(eq(taskActivities.taskId, taskId));
    const afterNoOpNotificationCount = await database.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.taskId, taskId));
    expect(afterNoOpActivityCount).toHaveLength(beforeNoOpActivityCount.length);
    expect(afterNoOpNotificationCount).toHaveLength(
      beforeNoOpNotificationCount.length,
    );

    const reassignmentActivities = await database.db
      .select({ type: taskActivities.type, metadata: taskActivities.metadata })
      .from(taskActivities)
      .where(eq(taskActivities.taskId, taskId));
    expect(
      reassignmentActivities.filter((activity) => activity.type === 'REASSIGNED'),
    ).toHaveLength(1);
    expect(reassignmentActivities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'REASSIGNED',
          metadata: expect.objectContaining({
            previousAssigneeId: employee.userId,
            newAssigneeId: operationsEmployee.userId,
            actorId: admin.userId,
          }),
        }),
      ]),
    );

    const reassignmentNotifications = await database.db
      .select({
        type: notifications.type,
        recipientUserId: notifications.recipientUserId,
      })
      .from(notifications)
      .where(eq(notifications.taskId, taskId));
    expect(reassignmentNotifications).toEqual(
      expect.arrayContaining([
        {
          type: 'TASK_REASSIGNED',
          recipientUserId: operationsEmployee.userId,
        },
      ]),
    );
  });

  afterAll(async () => {
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

    if (app) {
      await app.close();
    }
  });
});
