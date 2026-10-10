import type { Notification } from '../../database/schema.js';
import type { PaginatedResponse } from '../../tasks/types/task.types.js';

export type NotificationResponse = Pick<
  Notification,
  'id' | 'type' | 'title' | 'message' | 'taskId' | 'readAt' | 'createdAt'
>;

export type NotificationListResponse = PaginatedResponse<NotificationResponse>;

export interface MarkAllNotificationsReadResponse {
  updatedCount: number;
}
