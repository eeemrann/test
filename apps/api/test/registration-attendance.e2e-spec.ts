import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  attendance,
  refreshSessions,
  registrationAudits,
  users,
} from '../src/database/schema.js';
import { e2eAccountEmails, testPassword } from './e2e/accounts.js';
import {
  ensureIsolatedDatabase,
} from './e2e/setup-isolated-db.js';
import { loadLocalEnvironment } from './e2e/isolated-db.js';

loadLocalEnvironment();
if (process.env.DATABASE_URL?.endsWith('/office_management_e2e')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    '/office_management_e2e',
    '/office_management',
  );
}
const isolatedDatabaseUrl = await ensureIsolatedDatabase();
process.env.DATABASE_URL = isolatedDatabaseUrl;
process.env.E2E_DATABASE_URL = isolatedDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.OFFICE_TIMEZONE = 'Asia/Dhaka';
process.env.OFFICE_WORKDAYS = '0,1,2,3,4';
process.env.OFFICE_HOLIDAYS = '2026-10-08';
process.env.OFFICE_START_TIME = '10:00';
process.env.OFFICE_GRACE_END_TIME = '10:15';

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_MONTH = '2026-10';
const FIXTURE_FROM = new Date('2026-10-01T00:00:00.000Z');

type Account = { accessToken: string; userId: string };

function password(key: string): string {
  return testPassword(key);
}

function userEmail(label: string): string {
  return `phase-6-4-${label}-${RUN_ID}@office.local`;
}

function setServerTime(utcTimestamp: string): void {
  vi.setSystemTime(new Date(utcTimestamp));
}

describe('Registration and attendance APIs (isolated e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let admin: Account;
  let manager: Account;
  let employee: Account;
  let employeeTwo: Account;
  let operationsEmployee: Account;
  const createdUserIds: string[] = [];

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

  async function freshFixtureLogin(
    email: string,
    passwordKey: string,
  ): Promise<Account> {
    return login(email, passwordKey);
  }

  async function register(label: string) {
    const email = userEmail(label);
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: `Phase 6 Attendance ${label}`,
        email,
        password: 'Register.Password.123',
        confirmPassword: 'Register.Password.123',
      })
      .expect(201);

    const [user] = await database.db
      .select({ id: users.id, approvalStatus: users.approvalStatus })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new Error(`Registration fixture ${email} was not created`);
    createdUserIds.push(user.id);
    return { email, id: user.id, response };
  }

  async function insertAttendance(
    userId: string,
    date: string,
    checkInAt: string,
    checkInStatus: 'PRESENT' | 'LATE',
  ) {
    const timestamp = new Date(checkInAt);
    await database.db.insert(attendance).values({
      userId,
      attendanceDate: date,
      checkInAt: timestamp,
      checkInStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
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
    employee = await login(
      e2eAccountEmails.engineeringEmployee,
      'SEED_EMPLOYEE_PASSWORD',
    );
    employeeTwo = await login(
      'e2e.eng.employee.two@office.local',
      'SEED_EMPLOYEE_PASSWORD',
    );
    operationsEmployee = await login(
      e2eAccountEmails.operationsEmployee,
      'SEED_EMPLOYEE_PASSWORD',
    );

    const fixtureUserIds = [
      admin.userId,
      manager.userId,
      employee.userId,
      employeeTwo.userId,
      operationsEmployee.userId,
    ];
    await database.db
      .delete(attendance)
      .where(
        and(
          inArray(attendance.userId, fixtureUserIds),
          gte(attendance.attendanceDate, '2026-10-01'),
          lte(attendance.attendanceDate, '2026-10-31'),
        ),
      );
    await database.db
      .update(users)
      .set({ attendanceEligibleFrom: FIXTURE_FROM })
      .where(inArray(users.id, fixtureUserIds));

    vi.useFakeTimers({ toFake: ['Date'] });
    setServerTime('2026-10-11T04:00:00.000Z');
  });

  it('accepts public registration and prevents duplicate email registration', async () => {
    const created = await register('duplicate');

    expect(created.response.body.message).toContain('waiting for admin approval');
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Duplicate Attempt',
        email: created.email.toUpperCase(),
        password: 'Register.Password.123',
        confirmPassword: 'Register.Password.123',
      })
      .expect(409);
  });

  it('keeps pending registrations from logging in until an admin approves them', async () => {
    const pending = await register('pending');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: pending.email, password: 'Register.Password.123' })
      .expect(401);

    const list = await request(app.getHttpServer())
      .get('/admin/registrations')
      .query({ status: 'PENDING', search: pending.email })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(list.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pending.id, approvalStatus: 'PENDING' }),
      ]),
    );
  });

  it('allows admins to approve or reject and blocks all non-admin approval attempts', async () => {
    const approval = await register('approval');
    const rejection = await register('rejection');

    await request(app.getHttpServer())
      .patch(`/admin/registrations/${approval.id}/approve`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({})
      .expect(403);

    const approved = await request(app.getHttpServer())
      .patch(`/admin/registrations/${approval.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({})
      .expect(200);
    expect(approved.body).toMatchObject({
      id: approval.id,
      role: 'EMPLOYEE',
      approvalStatus: 'APPROVED',
      isActive: true,
    });

    const rejected = await request(app.getHttpServer())
      .patch(`/admin/registrations/${rejection.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(rejected.body).toMatchObject({
      id: rejection.id,
      approvalStatus: 'REJECTED',
      isActive: false,
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: rejection.email, password: 'Register.Password.123' })
      .expect(401);
  });

  it('accepts check-in before 10:00 AM Dhaka time as present', async () => {
    setServerTime('2026-10-11T03:59:59.000Z');
    const response = await request(app.getHttpServer())
      .post('/attendance/check-in')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(201);

    expect(response.body).toMatchObject({
      date: '2026-10-11',
      checkInStatus: 'PRESENT',
      timezone: 'Asia/Dhaka',
    });
  });

  it('classifies exactly 10:15:00 AM as present', async () => {
    setServerTime('2026-10-11T04:15:00.000Z');
    const response = await request(app.getHttpServer())
      .post('/attendance/check-in')
      .set('Authorization', `Bearer ${employeeTwo.accessToken}`)
      .expect(201);

    expect(response.body.checkInStatus).toBe('PRESENT');
  });

  it('classifies one second after 10:15 AM as late', async () => {
    setServerTime('2026-10-11T04:15:01.000Z');
    const response = await request(app.getHttpServer())
      .post('/attendance/check-in')
      .set('Authorization', `Bearer ${operationsEmployee.accessToken}`)
      .expect(201);

    expect(response.body.checkInStatus).toBe('LATE');
  });

  it('prevents duplicate check-in rows and retains the original check-in time', async () => {
    setServerTime('2026-10-11T05:00:00.000Z');
    const repeated = await request(app.getHttpServer())
      .post('/attendance/check-in')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(201);

    expect(repeated.body.checkInAt).toBe('2026-10-11T03:59:59.000Z');
    const rows = await database.db
      .select({ id: attendance.id })
      .from(attendance)
      .where(
        and(
          eq(attendance.userId, employee.userId),
          eq(attendance.attendanceDate, '2026-10-11'),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it('rejects checkout without a check-in', async () => {
    await request(app.getHttpServer())
      .post('/attendance/check-out')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(409);
  });

  it('checks out successfully and prevents duplicate checkout changes', async () => {
    setServerTime('2026-10-11T06:00:00.000Z');
    const currentEmployee = await freshFixtureLogin(
      'e2e.eng.employee.two@office.local',
      'SEED_EMPLOYEE_PASSWORD',
    );
    const checkedOut = await request(app.getHttpServer())
      .post('/attendance/check-out')
      .set('Authorization', `Bearer ${currentEmployee.accessToken}`)
      .expect(201);
    expect(checkedOut.body.status).toBe('CHECKED_OUT');

    setServerTime('2026-10-11T07:00:00.000Z');
    const repeatedEmployee = await freshFixtureLogin(
      'e2e.eng.employee.two@office.local',
      'SEED_EMPLOYEE_PASSWORD',
    );
    const repeated = await request(app.getHttpServer())
      .post('/attendance/check-out')
      .set('Authorization', `Bearer ${repeatedEmployee.accessToken}`)
      .expect(201);
    expect(repeated.body.alreadyCompleted).toBe(true);
    expect(repeated.body.checkOutAt).toBe(checkedOut.body.checkOutAt);
  });

  it('counts present and late days together, excludes holidays and weekends, and does not finalize today', async () => {
    await insertAttendance(
      employee.userId,
      '2026-10-01',
      '2026-10-01T04:00:00.000Z',
      'PRESENT',
    );
    await insertAttendance(
      employee.userId,
      '2026-10-04',
      '2026-10-04T05:00:00.000Z',
      'LATE',
    );

    setServerTime('2026-10-11T04:00:00.000Z');
    const response = await request(app.getHttpServer())
      .get('/attendance/me')
      .query({ month: TEST_MONTH, limit: 40 })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);

    expect(response.body.summary).toMatchObject({
      totalPresentDays: 2,
      totalLateDays: 1,
      totalMissedDays: 3,
      totalScheduledWorkingDays: 5,
    });
    expect(response.body.timezone).toBe('Asia/Dhaka');
    expect(response.body.data.find((entry: { date: string }) => entry.date === '2026-10-08')).toMatchObject({
      status: 'NON_WORKING_DAY',
    });
    expect(response.body.data.find((entry: { date: string }) => entry.date === '2026-10-10')).toMatchObject({
      status: 'NON_WORKING_DAY',
    });
    expect(response.body.data.find((entry: { date: string }) => entry.date === '2026-10-11')).toMatchObject({
      status: 'PRESENT',
    });

    const unfinishedDay = await request(app.getHttpServer())
      .get('/attendance/me')
      .query({ month: TEST_MONTH, limit: 40 })
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(unfinishedDay.body.summary).toMatchObject({
      totalMissedDays: 5,
      totalScheduledWorkingDays: 5,
    });
    expect(unfinishedDay.body.data.find((entry: { date: string }) => entry.date === '2026-10-11')).toMatchObject({
      status: 'NOT_CHECKED_IN',
    });
  });

  it('uses Asia/Dhaka date boundaries for the attendance day', async () => {
    setServerTime('2026-10-10T17:59:59.999Z');
    const beforeBoundary = await request(app.getHttpServer())
      .get('/attendance/today')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(beforeBoundary.body.date).toBe('2026-10-10');

    setServerTime('2026-10-10T18:00:00.000Z');
    const afterBoundary = await request(app.getHttpServer())
      .get('/attendance/today')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(afterBoundary.body.date).toBe('2026-10-11');
    expect(afterBoundary.body.timezone).toBe('Asia/Dhaka');
  });

  it('does not count days before a newly approved user becomes attendance eligible', async () => {
    const fresh = await register('fresh-approval');
    setServerTime('2026-10-11T04:00:00.000Z');
    await request(app.getHttpServer())
      .patch(`/admin/registrations/${fresh.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({})
      .expect(200);

    const user = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fresh.email, password: 'Register.Password.123' })
      .expect(201)
      .then((response) => ({
        accessToken: response.body.accessToken as string,
        userId: response.body.user.id as string,
      }));
    const attendanceSummary = await request(app.getHttpServer())
      .get('/attendance/me/summary')
      .query({ month: TEST_MONTH })
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(attendanceSummary.body).toMatchObject({
      totalPresentDays: 0,
      totalMissedDays: 0,
      totalScheduledWorkingDays: 0,
    });
  });

  it('limits manager attendance to their team and grants admin office-wide overview access', async () => {
    const managerTeam = await request(app.getHttpServer())
      .get('/attendance/team')
      .query({ month: TEST_MONTH })
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(managerTeam.body.data.every((entry: { user: { email: string } }) =>
      !entry.user.email.includes('ops.'))).toBe(true);

    await request(app.getHttpServer())
      .get('/attendance/overview')
      .query({ month: TEST_MONTH })
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.staff.every((person: { email: string }) =>
          !person.email.includes('ops.'))).toBe(true);
      });

    const adminOverview = await request(app.getHttpServer())
      .get('/attendance/overview')
      .query({ month: TEST_MONTH })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(adminOverview.body.staff.some((person: { email: string }) => person.email === e2eAccountEmails.operationsEmployee)).toBe(true);
    expect(adminOverview.body.staff.every((person: { role: string }) => person.role !== 'ADMIN')).toBe(true);
  });

  it('restricts employees to their own attendance records', async () => {
    await request(app.getHttpServer())
      .get('/attendance/me')
      .query({ month: TEST_MONTH })
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/attendance/team')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/attendance/overview')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(403);
  });

  afterAll(async () => {
    vi.useRealTimers();

    if (createdUserIds.length > 0 && database) {
      await database.db
        .delete(attendance)
        .where(inArray(attendance.userId, createdUserIds));
      await database.db
        .delete(refreshSessions)
        .where(inArray(refreshSessions.userId, createdUserIds));
      await database.db
        .delete(registrationAudits)
        .where(inArray(registrationAudits.userId, createdUserIds));
      await database.db.delete(users).where(inArray(users.id, createdUserIds));
    }

    await app?.close();
  });
});
