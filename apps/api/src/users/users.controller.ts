import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
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
  ): Promise<PaginatedResponse<AssignableUserResponse>> {
    return this.usersService.listAssignable(query);
  }
}
