import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';

@Injectable()
export class AuthorizationService {
  isAdmin(user: AuthenticatedUser | null | undefined): boolean {
    return user?.isActive === true && user.role === 'ADMIN';
  }

  isManager(user: AuthenticatedUser | null | undefined): boolean {
    return user?.isActive === true && user.role === 'MANAGER';
  }

  sameTeam(
    firstUser: AuthenticatedUser | null | undefined,
    secondUser: AuthenticatedUser | null | undefined,
  ): boolean {
    return (
      firstUser?.isActive === true &&
      secondUser?.isActive === true &&
      firstUser.teamId !== null &&
      secondUser.teamId !== null &&
      firstUser.teamId === secondUser.teamId
    );
  }

  canManageTeam(
    user: AuthenticatedUser | null | undefined,
    targetTeamId: string | null | undefined,
  ): boolean {
    if (!user?.isActive || !targetTeamId) {
      return false;
    }

    if (this.isAdmin(user)) {
      return true;
    }

    return this.isManager(user) && user.teamId === targetTeamId;
  }

  hasOfficeWideAdministrativeAuthority(
    user: AuthenticatedUser | null | undefined,
  ): boolean {
    return this.isAdmin(user);
  }
}
