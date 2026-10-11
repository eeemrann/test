import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { Roles } from '../authorization/decorators/roles.decorator.js';
import { RolesGuard } from '../authorization/guards/roles.guard.js';
import { ApproveRegistrationDto } from './dto/approve-registration.dto.js';
import { RegistrationQueryDto } from './dto/registration-query.dto.js';
import { AdminService } from './admin.service.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('registrations')
  listRegistrations(@Query() query: RegistrationQueryDto) {
    return this.adminService.listRegistrations(query);
  }

  @Patch('registrations/:id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveRegistrationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.approveRegistration(id, dto, request.user);
  }

  @Patch('registrations/:id/reject')
  reject(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.adminService.rejectRegistration(id, request.user);
  }
}
