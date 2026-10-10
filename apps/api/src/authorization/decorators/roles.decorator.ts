import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/types/auth.types.js';

export const ROLES_KEY = 'roles';
export type AuthorizationRole = AuthenticatedUser['role'];

export const Roles = (
  ...roles: AuthorizationRole[]
): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);
