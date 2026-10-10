import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { AuthRoles } from '../authorization/decorators/auth-roles.decorator.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { ReassignTaskDto } from './dto/reassign-task.dto.js';
import { TaskActivityQueryDto } from './dto/task-activity-query.dto.js';
import { TaskIdParamDto } from './dto/task-id-param.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';
import { TaskSummaryQueryDto } from './dto/task-summary-query.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';
import { TasksService } from './tasks.service.js';
import type {
  PaginatedResponse,
  TaskActivityResponse,
  TaskResponse,
  TaskSummaryResponse,
} from './types/task.types.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  createTask(
    @Body() dto: CreateTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponse> {
    return this.tasksService.createTask(dto, request.user);
  }

  @Patch(':id/assign')
  @AuthRoles('MANAGER', 'ADMIN')
  reassignTask(
    @Param() params: TaskIdParamDto,
    @Body() dto: ReassignTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponse> {
    return this.tasksService.reassignTask(
      params.id,
      dto,
      request.user,
    );
  }

  @Patch(':id/status')
  updateTaskStatus(
    @Param() params: TaskIdParamDto,
    @Body() dto: UpdateTaskStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponse> {
    return this.tasksService.updateTaskStatus(
      params.id,
      dto,
      request.user,
    );
  }

  @Patch(':id')
  updateTask(
    @Param() params: TaskIdParamDto,
    @Body() dto: UpdateTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponse> {
    return this.tasksService.updateTask(params.id, dto, request.user);
  }

  @Get('my')
  listMyTasks(
    @Req() request: AuthenticatedRequest,
    @Query() query: TaskQueryDto,
  ): Promise<PaginatedResponse<TaskResponse>> {
    return this.tasksService.listMyTasks(query, request.user.id);
  }

  @Get('summary')
  getTaskSummary(
    @Query() query: TaskSummaryQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskSummaryResponse> {
    return this.tasksService.getTaskSummary(query, request.user.id);
  }

  @Get()
  listTasks(
    @Query() query: TaskQueryDto,
  ): Promise<PaginatedResponse<TaskResponse>> {
    return this.tasksService.listTasks(query);
  }

  @Get(':id/activities')
  listTaskActivities(
    @Param() params: TaskIdParamDto,
    @Query() query: TaskActivityQueryDto,
  ): Promise<PaginatedResponse<TaskActivityResponse>> {
    return this.tasksService.listTaskActivities(params.id, query);
  }

  @Get(':id')
  getTask(@Param() params: TaskIdParamDto): Promise<TaskResponse> {
    return this.tasksService.getTaskById(params.id);
  }
}
