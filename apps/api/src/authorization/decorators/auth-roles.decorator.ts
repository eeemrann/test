import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { Roles, type AuthorizationRole } from './roles.decorator.js';
import { RolesGuard } from '../guards/roles.guard.js';

export const AuthRoles = (...roles: AuthorizationRole[]) =>
  applyDecorators(
    Roles(...roles),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
