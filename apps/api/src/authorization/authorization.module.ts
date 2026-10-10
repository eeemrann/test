import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AuthorizationService } from './authorization.service.js';
import { RolesGuard } from './guards/roles.guard.js';

@Module({
  imports: [AuthModule],
  providers: [AuthorizationService, RolesGuard, JwtAuthGuard],
  exports: [
    AuthModule,
    AuthorizationService,
    RolesGuard,
    JwtAuthGuard,
  ],
})
export class AuthorizationModule {}
