import type { Notification, NotificationType } from '@/features/notifications/types/notification.types'

const notificationTypeLabels: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'Task assigned',
  TASK_REASSIGNED: 'Task reassigned',
  TASK_STATUS_CHANGED: 'Task status changed',
  TASK_UPDATED: 'Task updated',
}

export function getNotificationTypeLabel(type: NotificationType): string {
  return notificationTypeLabels[type]
}

export function formatNotificationTime(value: string, now = new Date()): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  const differenceSeconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const absoluteSeconds = Math.abs(differenceSeconds)
  if (absoluteSeconds < 60) return 'Just now'
  if (absoluteSeconds < 3600) return `${Math.round(absoluteSeconds / 60)}m ${differenceSeconds < 0 ? 'ago' : 'from now'}`
  if (absoluteSeconds < 86_400) return `${Math.round(absoluteSeconds / 3600)}h ${differenceSeconds < 0 ? 'ago' : 'from now'}`
  if (absoluteSeconds < 604_800) return `${Math.round(absoluteSeconds / 86_400)}d ${differenceSeconds < 0 ? 'ago' : 'from now'}`
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function isUnreadNotification(notification: Pick<Notification, 'readAt'>): boolean {
  return notification.readAt === null
}
