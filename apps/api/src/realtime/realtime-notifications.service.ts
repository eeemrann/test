import { Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Server } from 'socket.io';
import { DatabaseService } from '../database/database.service.js';
import {
  notifications,
  type Notification,
} from '../database/schema.js';

export const NOTIFICATION_NEW_EVENT = 'notification:new';
export const NOTIFICATION_READ_EVENT = 'notification:read';
export const NOTIFICATIONS_READ_ALL_EVENT = 'notifications:read-all';
export const NOTIFICATIONS_UNREAD_COUNT_EVENT = 'notifications:unread-count';

export interface NotificationReadPayload {
  id: string;
  readAt: Date | null;
}

export interface NotificationsReadAllPayload {
  updatedCount: number;
}

export interface NotificationsUnreadCountPayload {
  count: number;
}

@Injectable()
export class RealtimeNotificationsService {
  private readonly logger = new Logger(RealtimeNotificationsService.name);
  private server: Server | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  roomForUser(userId: string): string {
    return `user:${userId}`;
  }

  async publishNewNotification(notification: Notification): Promise<void> {
    this.emitSafely(
      notification.recipientUserId,
      NOTIFICATION_NEW_EVENT,
      this.toNotificationPayload(notification),
    );
    await this.publishUnreadCount(notification.recipientUserId);
  }

  async publishNotificationRead(
    userId: string,
    payload: NotificationReadPayload,
  ): Promise<void> {
    this.emitSafely(userId, NOTIFICATION_READ_EVENT, {
      id: payload.id,
      readAt: payload.readAt,
    });
    await this.publishUnreadCount(userId);
  }

  async publishNotificationsReadAll(
    userId: string,
    updatedCount: number,
  ): Promise<void> {
    this.emitSafely(userId, NOTIFICATIONS_READ_ALL_EVENT, {
      updatedCount,
    } satisfies NotificationsReadAllPayload);
    await this.publishUnreadCount(userId);
  }

  async publishUnreadCount(userId: string): Promise<void> {
    try {
      const [row] = await this.databaseService.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientUserId, userId),
            isNull(notifications.readAt),
          ),
        );

      this.emitSafely(userId, NOTIFICATIONS_UNREAD_COUNT_EVENT, {
        count: Number(row?.count ?? 0),
      } satisfies NotificationsUnreadCountPayload);
    } catch {
      this.logger.warn('Unable to synchronize realtime unread count');
    }
  }

  private emitSafely(userId: string, event: string, payload: unknown): void {
    if (!this.server) {
      return;
    }

    try {
      this.server.to(this.roomForUser(userId)).emit(event, payload);
    } catch {
      this.logger.warn('Unable to deliver realtime notification event');
    }
  }

  private toNotificationPayload(notification: Notification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      taskId: notification.taskId,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  }
}
