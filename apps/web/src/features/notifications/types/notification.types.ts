export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_REASSIGNED',
  'TASK_STATUS_CHANGED',
  'TASK_UPDATED',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type Notification = {
  id: string
  type: NotificationType
  title: string
  message: string
  taskId: string | null
  readAt: string | null
  createdAt: string
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PaginatedNotifications = {
  data: Notification[]
  pagination: PaginationMeta
}

export type UnreadCountResponse = {
  count: number
}

export type MarkAllReadResponse = {
  updatedCount: number
}

export type NotificationReadEvent = {
  id: string
  readAt: string | null
}

export type NotificationsReadAllEvent = {
  updatedCount: number
}

export type NotificationsUnreadCountEvent = {
  count: number
}
