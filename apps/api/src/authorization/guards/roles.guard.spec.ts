import {
  ExecutionContext,
  ForbiddenException,
  Reflector,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { AuthRoles } from '../decorators/auth-roles.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import type { AuthenticatedUser } from '../../auth/types/auth.types.js';

const employee: AuthenticatedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Employee',
  email: 'employee@office.local',
  role: 'EMPLOYEE',
  teamId: '22222222-2222-4222-8222-222222222222',
  isActive: true,
};

const manager: AuthenticatedUser = {
  ...employee,
  role: 'MANAGER',
  email: 'manager@office.local',
};

const admin: AuthenticatedUser = {
  ...employee,
  role: 'ADMIN',
  email: 'admin@office.local',
  teamId: null,
};

function contextFor(
  user: AuthenticatedUser | undefined,
  body: Record<string, unknown> = {},
): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user, body }),
    }),
  } as unknown as ExecutionContext;
}

function guardFor(requiredRoles: AuthenticatedUser['role'][]) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;

  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows a user whose current role is explicitly listed', () => {
    expect(guardFor(['EMPLOYEE']).canActivate(contextFor(employee))).toBe(true);
    expect(guardFor(['MANAGER', 'ADMIN']).canActivate(contextFor(manager))).toBe(
      true,
    );
    expect(guardFor(['ADMIN']).canActivate(contextFor(admin))).toBe(true);
  });

  it('returns 403 for authenticated users without an explicitly permitted role', () => {
    expect(() => guardFor(['MANAGER']).canActivate(contextFor(employee))).toThrow(
      ForbiddenException,
    );
    expect(() => guardFor(['ADMIN']).canActivate(contextFor(manager))).toThrow(
      ForbiddenException,
    );
    expect(() => guardFor(['ADMIN']).canActivate(contextFor(employee))).toThrow(
      ForbiddenException,
    );
  });

  it('returns 401 when authentication is missing or inactive', () => {
    const inactive = { ...manager, isActive: false };

    expect(() => guardFor(['MANAGER']).canActivate(contextFor(undefined))).toThrow(
      UnauthorizedException,
    );
    expect(() => guardFor(['MANAGER']).canActivate(contextFor(inactive))).toThrow(
      UnauthorizedException,
    );
  });

  it('does not use a user-submitted role to elevate access', () => {
    expect(() =>
      guardFor(['ADMIN']).canActivate(contextFor(employee, { role: 'ADMIN' })),
    ).toThrow(ForbiddenException);
  });

  it('denies a guard with no explicit role metadata', () => {
    expect(() => guardFor([]).canActivate(contextFor(admin))).toThrow(
      ForbiddenException,
    );
  });

  it('composes JWT authentication before role authorization', () => {
    class FixtureController {
      @AuthRoles('MANAGER', 'ADMIN')
      securedRoute() {
        return true;
      }
    }

    const method = Object.getOwnPropertyDescriptor(
      FixtureController.prototype,
      'securedRoute',
    )?.value;
    expect(Reflect.getMetadata(ROLES_KEY, method)).toEqual(['MANAGER', 'ADMIN']);
    expect(Reflect.getMetadata('__guards__', method)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });
});
