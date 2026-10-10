import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthService } from '../auth.service.js';
import type { AuthenticatedUser } from '../types/auth.types.js';

const authenticatedUser: AuthenticatedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Test User',
  email: 'test@office.local',
  role: 'EMPLOYEE',
  teamId: null,
  isActive: true,
};

function contextFor(request: { headers: { authorization?: string }; user?: unknown }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('verifies a bearer token and loads the current user from the database', async () => {
    const verifyAsync = vi.fn().mockResolvedValue({
      sub: authenticatedUser.id,
      role: 'ADMIN',
    });
    const findActiveUserById = vi
      .fn()
      .mockResolvedValue(authenticatedUser);
    const guard = new JwtAuthGuard(
      { verifyAsync } as unknown as JwtService,
      { findActiveUserById } as unknown as AuthService,
    );
    const request = { headers: { authorization: 'Bearer test-token' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith('test-token', {
      algorithms: ['HS256'],
    });
    expect(findActiveUserById).toHaveBeenCalledWith(authenticatedUser.id);
    expect(request.user).toEqual(authenticatedUser);
  });

  it('rejects a missing bearer token', async () => {
    const guard = new JwtAuthGuard(
      { verifyAsync: vi.fn() } as unknown as JwtService,
      { findActiveUserById: vi.fn() } as unknown as AuthService,
    );

    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each(['invalid-token', 'expired-token'])(
    'rejects an %s token',
    async (token) => {
      const verifyAsync = vi.fn().mockRejectedValue(new Error('invalid token'));
      const guard = new JwtAuthGuard(
        { verifyAsync } as unknown as JwtService,
        { findActiveUserById: vi.fn() } as unknown as AuthService,
      );

      await expect(
        guard.canActivate(
          contextFor({ headers: { authorization: `Bearer ${token}` } }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('rejects an inactive or deleted current user', async () => {
    const guard = new JwtAuthGuard(
      { verifyAsync: vi.fn().mockResolvedValue({ sub: authenticatedUser.id }) } as unknown as JwtService,
      { findActiveUserById: vi.fn().mockResolvedValue(null) } as unknown as AuthService,
    );

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: 'Bearer test-token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
