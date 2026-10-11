import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { notifications, taskActivities, tasks } from '../src/database/schema.js';
import { e2eAccountEmails, testPassword } from './e2e/accounts.js';

const FIXTURE_PREFIX = `phase-6-3-${Date.now()}`;

type Account = { accessToken: string; userId: string };

function password(key: string): string {
  return testPassword(key);
}

describe('Task assignment and ownership permissions (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let admin: Account;
  let manager: Account;
  let operationsManager: Account;
  let employee: Account;
  const createdTaskIds: string[] = [];

  async function login(email: string, passwordKey: string): Promise<Account> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: password(passwordKey) })
      .expect(201);

    return {
      accessToken: response.body.accessToken as string,
      userId: response.body.user.id as string,
    };
  }

  async function createTask(
    actor: Account,
    assignee: Account,
    suffix: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${actor.accessToken}`)
      .send({
        title: `${FIXTURE_PREFIX}-${suffix}`,
        assignedToId: assignee.userId,
      })
      .expect(201);

    createdTaskIds.push(response.body.id as string);
    return response.body as { id: string; assignee: { id: string; role: string } };
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

    admin = await login(e2eAccountEmails.admin, 'SEED_ADMIN_PASSWORD');
    manager = await login(
      e2eAccountEmails.engineeringManager,
      'SEED_MANAGER_PASSWORD',
    );
    operationsManager = await login(
      e2eAccountEmails.operationsManager,
      'SEED_MANAGER_PASSWORD',
    );
    employee = await login(
      e2eAccountEmails.engineeringEmployee,
      'SEED_EMPLOYEE_PASSWORD',
    );
  });

  it.each([
    ['ADMIN', 'ADMIN', 'admin-to-admin', 'admin', 'admin'],
    ['ADMIN', 'MANAGER', 'admin-to-manager', 'admin', 'manager'],
    ['ADMIN', 'EMPLOYEE', 'admin-to-employee', 'admin', 'employee'],
    ['MANAGER', 'ADMIN', 'manager-to-admin', 'manager', 'admin'],
    ['MANAGER', 'EMPLOYEE', 'manager-to-employee', 'manager', 'employee'],
    ['EMPLOYEE', 'EMPLOYEE', 'employee-to-employee', 'employee', 'employee'],
  ] as const)(
    'allows %s to assign tasks to %s',
    async (_actorRole, targetRole, suffix, actorKey, targetKey) => {
      const actor = { admin, manager, employee }[actorKey];
      const target = { admin, manager, employee }[targetKey];
      const created = await createTask(actor, target, suffix);

      expect(created.assignee).toMatchObject({
        id: target.userId,
        role: targetRole,
      });
    },
  );

  it.each([
    ['MANAGER', 'MANAGER', 'manager-to-manager', 'manager', 'operationsManager'],
    ['EMPLOYEE', 'ADMIN', 'employee-to-admin', 'employee', 'admin'],
    ['EMPLOYEE', 'MANAGER', 'employee-to-manager', 'employee', 'manager'],
  ] as const)(
    'forbids %s from assigning tasks to %s',
    async (_actorRole, _targetRole, suffix, actorKey, targetKey) => {
      const actor = { manager, employee }[actorKey];
      const target = { admin, manager, operationsManager }[targetKey];

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .send({
          title: `${FIXTURE_PREFIX}-${suffix}`,
          assignedToId: target.userId,
        })
        .expect(403);
    },
  );

  it('lets assigned managers and admins progress only tasks assigned to themselves', async () => {
    const managerTask = await createTask(admin, manager, 'manager-progress');
    const adminTask = await createTask(admin, admin, 'admin-progress');
    const employeeTask = await createTask(admin, employee, 'employee-owned');

    await request(app.getHttpServer())
      .patch(`/tasks/${managerTask.id}/status`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/tasks/${managerTask.id}/status`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ status: 'DONE' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tasks/${adminTask.id}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/tasks/${adminTask.id}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'DONE' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tasks/${employeeTask.id}/status`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ status: 'WORKING' })
      .expect(403);

    const managerTasks = await request(app.getHttpServer())
      .get('/tasks/my')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(managerTasks.body.data.some((task: { id: string }) => task.id === managerTask.id)).toBe(true);
    expect(managerTasks.body.data.some((task: { id: string }) => task.id === employeeTask.id)).toBe(false);
  });

  afterAll(async () => {
    if (createdTaskIds.length > 0 && database) {
      await database.db
        .delete(notifications)
        .where(inArray(notifications.taskId, createdTaskIds));
      await database.db
        .delete(taskActivities)
        .where(inArray(taskActivities.taskId, createdTaskIds));
      await database.db.delete(tasks).where(inArray(tasks.id, createdTaskIds));
    }

    await app?.close();
  });
});
