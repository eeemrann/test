import { AuthorizationService } from './authorization.service.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';

const ENGINEERING_TEAM_ID = '22222222-2222-4222-8222-222222222222';
const OPERATIONS_TEAM_ID = '33333333-3333-4333-8333-333333333333';

function user(
  role: AuthenticatedUser['role'],
  teamId: string | null = null,
  isActive = true,
): AuthenticatedUser {
  return {
    id: `${role.toLowerCase()}-user-id`,
    fullName: `${role} User`,
    email: `${role.toLowerCase()}@office.local`,
    role,
    teamId,
    isActive,
  };
}

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  it('identifies only active admins and managers', () => {
    expect(service.isAdmin(user('ADMIN'))).toBe(true);
    expect(service.isAdmin(user('MANAGER'))).toBe(false);
    expect(service.isManager(user('MANAGER', ENGINEERING_TEAM_ID))).toBe(true);
    expect(service.isManager(user('EMPLOYEE', ENGINEERING_TEAM_ID))).toBe(false);
    expect(service.isAdmin(user('ADMIN', null, false))).toBe(false);
    expect(service.isManager(undefined)).toBe(false);
  });

  it('matches only active users with the same non-null team', () => {
    expect(
      service.sameTeam(
        user('MANAGER', ENGINEERING_TEAM_ID),
        user('EMPLOYEE', ENGINEERING_TEAM_ID),
      ),
    ).toBe(true);
    expect(
      service.sameTeam(
        user('MANAGER', ENGINEERING_TEAM_ID),
        user('EMPLOYEE', OPERATIONS_TEAM_ID),
      ),
    ).toBe(false);
    expect(service.sameTeam(user('ADMIN'), user('EMPLOYEE'))).toBe(false);
    expect(
      service.sameTeam(
        user('MANAGER', ENGINEERING_TEAM_ID, false),
        user('EMPLOYEE', ENGINEERING_TEAM_ID),
      ),
    ).toBe(false);
  });

  it('gives admins global team scope and managers only their own team', () => {
    const admin = user('ADMIN');
    const engineeringManager = user('MANAGER', ENGINEERING_TEAM_ID);
    const operationsManager = user('MANAGER', OPERATIONS_TEAM_ID);
    const employee = user('EMPLOYEE', ENGINEERING_TEAM_ID);

    expect(service.canManageTeam(admin, ENGINEERING_TEAM_ID)).toBe(true);
    expect(service.canManageTeam(admin, OPERATIONS_TEAM_ID)).toBe(true);
    expect(
      service.canManageTeam(engineeringManager, ENGINEERING_TEAM_ID),
    ).toBe(true);
    expect(service.canManageTeam(engineeringManager, OPERATIONS_TEAM_ID)).toBe(
      false,
    );
    expect(service.canManageTeam(operationsManager, OPERATIONS_TEAM_ID)).toBe(
      true,
    );
    expect(service.canManageTeam(operationsManager, ENGINEERING_TEAM_ID)).toBe(
      false,
    );
    expect(service.canManageTeam(employee, ENGINEERING_TEAM_ID)).toBe(false);
    expect(service.canManageTeam(engineeringManager, null)).toBe(false);
    expect(service.canManageTeam(undefined, ENGINEERING_TEAM_ID)).toBe(false);
  });

  it('grants office-wide administrative authority only to active admins', () => {
    expect(service.hasOfficeWideAdministrativeAuthority(user('ADMIN'))).toBe(
      true,
    );
    expect(
      service.hasOfficeWideAdministrativeAuthority(
        user('ADMIN', null, false),
      ),
    ).toBe(false);
    expect(
      service.hasOfficeWideAdministrativeAuthority(
        user('MANAGER', ENGINEERING_TEAM_ID),
      ),
    ).toBe(false);
  });
});
