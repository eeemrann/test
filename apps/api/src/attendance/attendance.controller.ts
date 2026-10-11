import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { AttendanceQueryDto } from './dto/attendance-query.dto.js';
import { AttendanceService } from './attendance.service.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('today')
  getToday(@Req() request: AuthenticatedRequest) {
    return this.attendanceService.getToday(request.user);
  }

  @Post('check-in')
  checkIn(@Req() request: AuthenticatedRequest) {
    return this.attendanceService.checkIn(request.user);
  }

  @Post('check-out')
  checkOut(@Req() request: AuthenticatedRequest) {
    return this.attendanceService.checkOut(request.user);
  }

  @Get('me')
  getMine(@Req() request: AuthenticatedRequest, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.getMine(request.user, query);
  }

  @Get('me/summary')
  getSummary(@Req() request: AuthenticatedRequest, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.getSummary(request.user, query);
  }

  @Get('team')
  getTeam(@Req() request: AuthenticatedRequest, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.getTeam(request.user, query);
  }

  @Get('overview')
  getOverview(@Req() request: AuthenticatedRequest, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.getOverview(request.user, query);
  }
}
