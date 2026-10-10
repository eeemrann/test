import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  and,
  desc,
  eq,
  isNull,
  sql,
} from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { notifications } from '../database/schema.js';
import type { NotificationQueryDto } from './dto/notification-query.dto.js';
import type {
  MarkAllNotificationsReadResponse,
  NotificationListResponse,
  NotificationResponse,
} from './types/notification.types.js';
import { RealtimeNotificationsService } from '../realtime/realtime-notifications.service.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const notificationResponseFields = {
  id: notifications.id,
  type: notifications.type,
  title: notifications.title,
  message: notifications.message,
  taskId: notifications.taskId,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Optional()
    private readonly realtimeNotificationsService?: RealtimeNotificationsService,
  ) {}

  async listNotifications(
    query: NotificationQueryDto,
    recipientUserId: string,
  ): Promise<NotificationListResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filters = [eq(notifications.recipientUserId, recipientUserId)];

    if (query.unreadOnly === true) {
      filters.push(isNull(notifications.readAt));
    }

    const where = and(...filters);

    try {
      const [countRows, rows] = await Promise.all([
        this.databaseService.db
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications)
          .where(where),
        this.databaseService.db
          .select(notificationResponseFields)
          .from(notifications)
          .where(where)
          .orderBy(desc(notifications.createdAt), desc(notifications.id))
          .limit(limit)
          .offset((page - 1) * limit),
      ]);

      const total = Number(countRows[0]?.count ?? 0);
      return {
        data: rows.map((row) => this.toNotificationResponse(row)),
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      };
    } catch {
      throw new InternalServerErrorException(
        'Notification operation failed',
      );
    }
  }

  async getUnreadCount(recipientUserId: string): Promise<{ count: number }> {
    try {
      const [row] = await this.databaseService.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientUserId, recipientUserId),
            isNull(notifications.readAt),
          ),
        );

      return { count: Number(row?.count ?? 0) };
    } catch {
      throw new InternalServerErrorException(
        'Notification operation failed',
      );
    }
  }

  async markAsRead(
    notificationId: string,
    recipientUserId: string,
  ): Promise<NotificationResponse> {
    const readAt = new Date();

    try {
      const [notification] = await this.databaseService.db
        .update(notifications)
        .set({
          readAt,
        })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.recipientUserId, recipientUserId),
            isNull(notifications.readAt),
          ),
        )
        .returning(notificationResponseFields);

      if (notification) {
        const response = this.toNotificationResponse(notification);
        await this.realtimeNotificationsService?.publishNotificationRead(
          recipientUserId,
          { id: response.id, readAt: response.readAt },
        );
        return response;
      }

      const [alreadyRead] = await this.databaseService.db
        .select(notificationResponseFields)
        .from(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.recipientUserId, recipientUserId),
          ),
        )
        .limit(1);

      if (!alreadyRead) {
        throw new NotFoundException('Notification not found');
      }

      return this.toNotificationResponse(alreadyRead);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Notification operation failed',
      );
    }
  }

  async markAllAsRead(
    recipientUserId: string,
  ): Promise<MarkAllNotificationsReadResponse> {
    try {
      const updated = await this.databaseService.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.recipientUserId, recipientUserId),
            isNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });

      const response = { updatedCount: updated.length };
      if (response.updatedCount > 0) {
        await this.realtimeNotificationsService?.publishNotificationsReadAll(
          recipientUserId,
          response.updatedCount,
        );
      } else {
        await this.realtimeNotificationsService?.publishUnreadCount(
          recipientUserId,
        );
      }
      return response;
    } catch {
      throw new InternalServerErrorException(
        'Notification operation failed',
      );
    }
  }

  private toNotificationResponse(
    notification: NotificationResponse,
  ): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      taskId: notification.taskId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
