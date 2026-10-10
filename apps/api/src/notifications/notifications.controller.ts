import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { NotificationIdParamDto } from './dto/notification-id-param.dto.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';
import { NotificationsService } from './notifications.service.js';
import type {
  MarkAllNotificationsReadResponse,
  NotificationListResponse,
  NotificationResponse,
} from './types/notification.types.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread-count')
  getUnreadCount(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ count: number }> {
    return this.notificationsService.getUnreadCount(request.user.id);
  }

  @Get()
  listNotifications(
    @Query() query: NotificationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.listNotifications(query, request.user.id);
  }

  @Patch('read-all')
  markAllAsRead(
    @Req() request: AuthenticatedRequest,
  ): Promise<MarkAllNotificationsReadResponse> {
    return this.notificationsService.markAllAsRead(request.user.id);
  }

  @Patch(':id/read')
  markAsRead(
    @Param() params: NotificationIdParamDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markAsRead(
      params.id,
      request.user.id,
    );
  }
}
