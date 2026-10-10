import { api } from '@/lib/api'
import type {
  MarkAllReadResponse,
  PaginatedNotifications,
  UnreadCountResponse,
  Notification,
} from '@/features/notifications/types/notification.types'

export const NOTIFICATION_PAGE_SIZE = 20

export async function getNotifications({
  page = 1,
  limit = NOTIFICATION_PAGE_SIZE,
  unreadOnly = false,
}: {
  page?: number
  limit?: number
  unreadOnly?: boolean
} = {}): Promise<PaginatedNotifications> {
  const response = await api.get<PaginatedNotifications>('/notifications', {
    params: {
      page,
      limit,
      ...(unreadOnly ? { unreadOnly: true } : {}),
    },
  })
  return response.data
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  const response = await api.get<UnreadCountResponse>('/notifications/unread-count')
  return response.data
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const response = await api.patch<Notification>(`/notifications/${id}/read`)
  return response.data
}

export async function markAllNotificationsRead(): Promise<MarkAllReadResponse> {
  const response = await api.patch<MarkAllReadResponse>('/notifications/read-all')
  return response.data
}
