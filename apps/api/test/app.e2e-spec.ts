import {
  Body,
  Controller,
  Get,
  INestApplication,
  Post,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { eq, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AuthRoles } from './../src/authorization/decorators/auth-roles.decorator.js';
import { AuthorizationModule } from './../src/authorization/authorization.module.js';
import { AuthorizationService } from './../src/authorization/authorization.service.js';
import type { AuthenticatedUser } from './../src/auth/types/auth.types.js';
import { DatabaseService } from './../src/database/database.service.js';
import { refreshSessions, users } from './../src/database/schema.js';

function seedPassword(key: string): string {
  const password = process.env[key];

  if (!password) {
    throw new Error(`${key} is required for local e2e tests`);
  }

  return password;
}

function refreshCookiePair(response: { headers: Record<string, unknown> }): string {
  const cookies = response.headers['set-cookie'];
  const cookie = Array.isArray(cookies)
    ? cookies.find((value): value is string =>
        value.startsWith('office_refresh_token='),
      )
    : undefined;

  if (!cookie) {
    throw new Error('Refresh cookie was not set');
  }

  return cookie.split(';', 1)[0];
}

function refreshCookieValue(cookiePair: string): string {
  return decodeURIComponent(cookiePair.slice(cookiePair.indexOf('=') + 1));
}

type RequestWithUser = Request & { user: AuthenticatedUser };

@Controller('test-authorization')
class AuthorizationFixtureController {
  @Get('employee')
  @AuthRoles('EMPLOYEE')
  employeeRoute(@Req() request: RequestWithUser) {
    return { role: request.user.role };
  }

  @Get('manager')
  @AuthRoles('MANAGER')
  managerRoute(@Req() request: RequestWithUser) {
    return { role: request.user.role };
  }

  @Get('admin')
  @AuthRoles('ADMIN')
  adminRoute(@Req() request: RequestWithUser) {
    return { role: request.user.role };
  }

  @Get('manager-or-admin')
  @AuthRoles('MANAGER', 'ADMIN')
  managerOrAdminRoute(@Req() request: RequestWithUser) {
    return { role: request.user.role };
  }

  @Post('admin-submitted-role')
  @AuthRoles('ADMIN')
  adminSubmittedRoleRoute(
    @Body() body: { role?: string },
    @Req() request: RequestWithUser,
  ) {
    return { authenticatedRole: request.user.role, submittedRole: body.role };
  }
}

describe('Application authentication (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AuthorizationModule],
      controllers: [AuthorizationFixtureController],
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
  });

  it('preserves the public root and database health endpoints', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');

    await request(app.getHttpServer())
      .get('/health/database')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
  });

  it.each([
    ['ADMIN', 'admin@office.local', 'SEED_ADMIN_PASSWORD'],
    ['MANAGER', 'eng.manager@office.local', 'SEED_MANAGER_PASSWORD'],
    ['EMPLOYEE', 'eng.employee@office.local', 'SEED_EMPLOYEE_PASSWORD'],
  ] as const)('logs in a valid %s account', async (role, email, passwordKey) => {
    const password = seedPassword(passwordKey);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ` ${email.toUpperCase()} `, password })
      .expect(201);

    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email, role },
    });
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects incorrect and unknown credentials generically', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@office.local', password: 'Wrong.Password.123!' })
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe('Invalid email or password');
      });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@office.local', password: 'Wrong.Password.123!' })
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe('Invalid email or password');
      });
  });

  it('rejects malformed login requests', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'not-an-email',
        password: '',
        unexpected: 'rejected',
      })
      .expect(400);
  });

  it('protects /auth/me and returns the current sanitized user', async () => {
    const password = seedPassword('SEED_ADMIN_PASSWORD');

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@office.local', password })
      .expect(201);
    const token = login.body.accessToken as string;

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body).toMatchObject({
      id: login.body.user.id,
      fullName: 'System Admin',
      email: 'admin@office.local',
      role: 'ADMIN',
      teamId: null,
      isActive: true,
    });
    expect(me.body).not.toHaveProperty('passwordHash');
    expect(Object.keys(me.body).sort()).toEqual([
      'email',
      'fullName',
      'id',
      'isActive',
      'role',
      'teamId',
    ]);
  });

  it('rejects missing, invalid, and expired access tokens', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    const password = seedPassword('SEED_ADMIN_PASSWORD');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@office.local', password })
      .expect(201);
    const expiredToken = app
      .get(JwtService)
      .sign({ sub: login.body.user.id }, { expiresIn: -1 });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('creates a hash-only HttpOnly refresh cookie on login', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@office.local',
        password: seedPassword('SEED_ADMIN_PASSWORD'),
      })
      .expect(201);
    const cookiePair = refreshCookiePair(login);
    const rawToken = refreshCookieValue(cookiePair);
    const setCookie = (login.headers['set-cookie'] as string[]).find((value) =>
      value.startsWith('office_refresh_token='),
    );

    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/auth');
    expect(setCookie).not.toContain('Secure');
    expect(login.body).not.toHaveProperty('refreshToken');

    const rows = await app
      .get(DatabaseService)
      .db.select({ tokenHash: refreshSessions.tokenHash })
      .from(refreshSessions)
      .where(
        eq(
          refreshSessions.tokenHash,
          createHash('sha256').update(rawToken, 'utf8').digest('hex'),
        ),
      )
      .limit(1);

    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].tokenHash).not.toBe(rawToken);
  });

  it('refreshes with rotation, rejects replay, and supports repeated logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@office.local',
        password: seedPassword('SEED_ADMIN_PASSWORD'),
      })
      .expect(201);
    const oldCookie = refreshCookiePair(login);

    const refresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(201);
    const replacementCookie = refreshCookiePair(refresh);

    expect(refresh.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email: 'admin@office.local', role: 'ADMIN' },
    });
    expect(refresh.body).not.toHaveProperty('refreshToken');
    expect(replacementCookie).not.toBe(oldCookie);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(401);

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', replacementCookie)
      .expect(204);
    const clearedCookie = (logout.headers['set-cookie'] as string[]).find(
      (value) => value.startsWith('office_refresh_token='),
    );
    expect(clearedCookie).toContain(
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
    expect(clearedCookie).toContain('Path=/auth');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', replacementCookie)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', replacementCookie)
      .expect(204);
  });

  it('rejects missing or invalid refresh cookies', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'office_refresh_token=invalid-token')
      .expect(401);
  });

  it('rejects untrusted browser origins for cookie-authenticated POST endpoints', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'https://evil.example')
      .expect(403);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', 'https://evil.example')
      .expect(403);
  });

  async function loginFor(email: string, passwordKey: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: seedPassword(passwordKey) })
      .expect(201);

    return {
      accessToken: response.body.accessToken as string,
      userId: response.body.user.id as string,
    };
  }

  it('enforces explicit employee, manager, and admin route roles', async () => {
    const employee = await loginFor(
      'eng.employee@office.local',
      'SEED_EMPLOYEE_PASSWORD',
    );
    const manager = await loginFor(
      'eng.manager@office.local',
      'SEED_MANAGER_PASSWORD',
    );
    const admin = await loginFor(
      'admin@office.local',
      'SEED_ADMIN_PASSWORD',
    );

    await request(app.getHttpServer())
      .get('/test-authorization/employee')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200)
      .expect({ role: 'EMPLOYEE' });
    await request(app.getHttpServer())
      .get('/test-authorization/manager')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/test-authorization/admin')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/test-authorization/manager')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200)
      .expect({ role: 'MANAGER' });
    await request(app.getHttpServer())
      .get('/test-authorization/admin')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/test-authorization/manager-or-admin')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(200)
      .expect({ role: 'MANAGER' });

    await request(app.getHttpServer())
      .get('/test-authorization/admin')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect({ role: 'ADMIN' });
    await request(app.getHttpServer())
      .get('/test-authorization/manager-or-admin')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect({ role: 'ADMIN' });
  });

  it('preserves 401 for missing or invalid authentication on role routes', async () => {
    await request(app.getHttpServer())
      .get('/test-authorization/admin')
      .expect(401);
    await request(app.getHttpServer())
      .get('/test-authorization/admin')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('does not trust submitted or stale JWT role values', async () => {
    const employee = await loginFor(
      'eng.employee@office.local',
      'SEED_EMPLOYEE_PASSWORD',
    );
    const staleRoleToken = app.get(JwtService).sign({
      sub: employee.userId,
      role: 'ADMIN',
    });

    await request(app.getHttpServer())
      .get('/test-authorization/admin')
      .set('Authorization', `Bearer ${staleRoleToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/test-authorization/admin-submitted-role')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ role: 'ADMIN' })
      .expect(403);
  });

  it('applies team-scoped policies to the existing seeded users', async () => {
    const demoEmails = [
      'admin@office.local',
      'eng.manager@office.local',
      'ops.manager@office.local',
      'eng.employee@office.local',
      'ops.employee@office.local',
    ];
    const demoUsers = await app
      .get(DatabaseService)
      .db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        teamId: users.teamId,
        isActive: users.isActive,
      })
      .from(users)
      .where(inArray(users.email, demoEmails));
    const byEmail = new Map(demoUsers.map((user) => [user.email, user]));
    const authorization = app.get(AuthorizationService);
    const admin = byEmail.get('admin@office.local') as AuthenticatedUser;
    const engineeringManager = byEmail.get(
      'eng.manager@office.local',
    ) as AuthenticatedUser;
    const operationsManager = byEmail.get(
      'ops.manager@office.local',
    ) as AuthenticatedUser;
    const engineeringEmployee = byEmail.get(
      'eng.employee@office.local',
    ) as AuthenticatedUser;
    const operationsEmployee = byEmail.get(
      'ops.employee@office.local',
    ) as AuthenticatedUser;

    expect(demoUsers).toHaveLength(5);
    expect(engineeringManager.teamId).not.toBeNull();
    expect(operationsManager.teamId).not.toBeNull();
    expect(
      authorization.canManageTeam(
        engineeringManager,
        engineeringManager.teamId,
      ),
    ).toBe(true);
    expect(
      authorization.canManageTeam(
        engineeringManager,
        operationsManager.teamId,
      ),
    ).toBe(false);
    expect(
      authorization.canManageTeam(operationsManager, operationsManager.teamId),
    ).toBe(true);
    expect(
      authorization.canManageTeam(operationsManager, engineeringManager.teamId),
    ).toBe(false);
    expect(authorization.canManageTeam(admin, engineeringManager.teamId)).toBe(
      true,
    );
    expect(authorization.canManageTeam(admin, operationsManager.teamId)).toBe(
      true,
    );
    expect(
      authorization.canManageTeam(
        engineeringEmployee,
        engineeringManager.teamId,
      ),
    ).toBe(false);
    expect(
      authorization.canManageTeam(operationsEmployee, operationsManager.teamId),
    ).toBe(false);
    expect(authorization.canManageTeam(admin, null)).toBe(false);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
