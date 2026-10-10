import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { DatabaseService } from '../database/database.service.js';
import { refreshSessions, type User } from '../database/schema.js';
import { AuthService } from './auth.service.js';

const TEST_PASSWORD = 'Unit.Test.Password.123!';
type RefreshSession = typeof refreshSessions.$inferSelect;

function makeUser(overrides: Partial<User> = {}, passwordHash: string): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Test User',
    email: 'test@office.local',
    passwordHash,
    role: 'EMPLOYEE',
    teamId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSession(
  userId: string,
  overrides: Partial<RefreshSession> = {},
): RefreshSession {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    userId,
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function createRotationTransaction(
  session: RefreshSession | undefined,
  user: User | undefined,
  claimSucceeds: boolean,
) {
  const limit = vi
    .fn()
    .mockResolvedValueOnce(session ? [session] : [])
    .mockResolvedValueOnce(user ? [user] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const returning = vi
    .fn()
    .mockResolvedValue(claimSucceeds && session ? [{ id: session.id }] : []);
  const updateWhere = vi.fn().mockReturnValue({ returning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: insertValues });
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ select, update, insert }),
  );

  return { transaction, updateSet, insertValues };
}

function createService(
  user: User | undefined,
  transaction: ReturnType<typeof vi.fn> = vi.fn(),
) {
  const limit = vi.fn().mockResolvedValue(user ? [user] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: insertValues });
  const databaseService = {
    db: { select, insert, transaction },
  } as unknown as DatabaseService;
  const configService = {
    get: vi.fn((key: string) => {
      const values: Record<string, string> = {
        REFRESH_TOKEN_TTL_DAYS: '7',
        FRONTEND_URL: 'http://localhost:5173',
        NODE_ENV: 'test',
      };
      return values[key];
    }),
  } as unknown as ConfigService;
  const signAsync = vi.fn().mockResolvedValue('test-access-token');
  const jwtService = { signAsync } as unknown as JwtService;

  return {
    service: new AuthService(configService, databaseService, jwtService),
    insertValues,
    signAsync,
  };
}

describe('AuthService', () => {
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  });

  it.each([
    ['ADMIN', 'System Admin', null],
    ['MANAGER', 'Engineering Manager', '22222222-2222-4222-8222-222222222222'],
    ['EMPLOYEE', 'Engineering Employee', '22222222-2222-4222-8222-222222222222'],
  ] as const)('logs in a valid %s user', async (role, fullName, teamId) => {
    const user = makeUser(
      {
        role,
        fullName,
        teamId,
        email: `${role.toLowerCase()}@office.local`,
      },
      passwordHash,
    );
    const { service, insertValues, signAsync } = createService(user);

    const result = await service.login(
      ` ${user.email.toUpperCase()} `,
      TEST_PASSWORD,
    );

    expect(result).toMatchObject({
      accessToken: 'test-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: user.id,
        fullName,
        email: user.email,
        role,
        teamId,
      },
    });
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    );
    expect(signAsync).toHaveBeenCalledWith({ sub: user.id });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects an incorrect password with generic credentials error', async () => {
    const user = makeUser({}, passwordHash);
    const { service } = createService(user);

    await expect(
      service.login(user.email, 'Wrong.Password.123!'),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
  });

  it('rejects an unknown email with the same generic credentials error', async () => {
    const { service } = createService(undefined);

    await expect(
      service.login('missing@office.local', TEST_PASSWORD),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
  });

  it('rejects inactive users', async () => {
    const user = makeUser({ isActive: false }, passwordHash);
    const { service } = createService(user);

    await expect(service.login(user.email, TEST_PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates a valid refresh session and stores only a hash', async () => {
    const user = makeUser({}, passwordHash);
    const session = makeSession(user.id);
    const rotation = createRotationTransaction(session, user, true);
    const { service, signAsync } = createService(
      undefined,
      rotation.transaction,
    );

    const result = await service.refresh('presented-refresh-token');

    expect(result).toMatchObject({
      accessToken: 'test-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: user.id },
    });
    expect(result.refreshToken).not.toBe('presented-refresh-token');
    expect(rotation.updateSet).toHaveBeenCalledWith({
      revokedAt: expect.any(Date),
    });
    expect(rotation.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    );
    expect(signAsync).toHaveBeenCalledWith({ sub: user.id });
  });

  it.each([
    ['missing', undefined, undefined, false],
    [
      'expired',
      makeSession('11111111-1111-4111-8111-111111111111', {
        expiresAt: new Date(Date.now() - 1000),
      }),
      undefined,
      true,
    ],
    [
      'revoked',
      makeSession('11111111-1111-4111-8111-111111111111', {
        revokedAt: new Date(),
      }),
      undefined,
      true,
    ],
    [
      'inactive user',
      makeSession('11111111-1111-4111-8111-111111111111'),
      makeUser({ isActive: false }, passwordHash),
      true,
    ],
  ] as const)(
    'rejects a %s refresh session',
    async (_name, session, user, claimSucceeds) => {
      const rotation = createRotationTransaction(session, user, claimSucceeds);
      const { service } = createService(undefined, rotation.transaction);

      await expect(
        service.refresh('invalid-or-replayed-token'),
      ).rejects.toMatchObject({
        status: 401,
        message: 'Invalid refresh token',
      });
    },
  );

  it('allows only one of two concurrent rotations to claim a session', async () => {
    const user = makeUser({}, passwordHash);
    const session = makeSession(user.id);
    const winningRotation = createRotationTransaction(session, user, true);
    const losingRotation = createRotationTransaction(session, user, false);
    const transaction = vi
      .fn()
      .mockImplementationOnce(winningRotation.transaction)
      .mockImplementationOnce(losingRotation.transaction);
    const { service } = createService(undefined, transaction);

    const results = await Promise.allSettled([
      service.refresh('same-presented-token'),
      service.refresh('same-presented-token'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
  });
});
