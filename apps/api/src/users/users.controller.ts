import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { AssignableUserQueryDto } from './dto/assignable-user-query.dto.js';
import { UsersService } from './users.service.js';
import type {
  AssignableUserResponse,
  PaginatedResponse,
} from '../tasks/types/task.types.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('assignable')
  listAssignable(
    @Query() query: AssignableUserQueryDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<PaginatedResponse<AssignableUserResponse>> {
    return this.usersService.listAssignable(query, request.user);
  }

  @Get('teams')
  listTeams() {
    return this.usersService.listTeams();
  }
}
