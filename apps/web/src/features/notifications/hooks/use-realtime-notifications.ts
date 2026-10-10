import { useEffect } from 'react'
import { refreshAccessToken } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { subscribeAccessToken } from '@/features/auth/auth-token'
import { taskQueryKeys } from '@/features/tasks/hooks/use-tasks'
import { invalidateNotificationQueries } from '@/features/notifications/lib/notification-query-invalidation'
import { notificationQueryKeys } from '@/features/notifications/lib/notification-query-keys'
import { createNotificationSocket, isSocketAuthenticationError, type NotificationSocket } from '@/features/notifications/lib/notification-socket'
import { NOTIFICATION_TYPES, type Notification, type NotificationsReadAllEvent, type NotificationReadEvent, type NotificationsUnreadCountEvent } from '@/features/notifications/types/notification.types'

const MAX_TRANSPORT_RETRIES = 5
const MAX_AUTH_RECOVERY_ATTEMPTS = 2
const BASE_RECONNECT_DELAY_MS = 500
const MAX_RECONNECT_DELAY_MS = 8_000

function isNotificationType(value: unknown): value is Notification['type'] {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

function isNotification(value: unknown): value is Notification {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.id === 'string' && isNotificationType(candidate.type) && typeof candidate.title === 'string' && typeof candidate.message === 'string' && (typeof candidate.taskId === 'string' || candidate.taskId === null) && (typeof candidate.readAt === 'string' || candidate.readAt === null) && typeof candidate.createdAt === 'string'
}

function isNotificationReadEvent(value: unknown): value is NotificationReadEvent {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.id === 'string' && (typeof candidate.readAt === 'string' || candidate.readAt === null)
}

function isReadAllEvent(value: unknown): value is NotificationsReadAllEvent {
  return Boolean(value && typeof value === 'object' && typeof (value as Record<string, unknown>).updatedCount === 'number')
}

function isUnreadCountEvent(value: unknown): value is NotificationsUnreadCountEvent {
  if (!value || typeof value !== 'object') return false
  const count = (value as Record<string, unknown>).count
  return typeof count === 'number' && count >= 0
}

export function useRealtimeNotifications({ userId, isAuthenticated }: { userId: string | undefined; isAuthenticated: boolean }): void {
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return
    }

    let disposed = false
    let socket: NotificationSocket | null = null
    let reconnectTimer: number | null = null
    let transportAttempts = 0
    let authRecoveryAttempts = 0
    let authRecoveryInFlight = false
    let reconnectingForTokenChange = false

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const invalidateNotifications = () => {
      if (disposed) return
      void invalidateNotificationQueries(userId)
    }

    const invalidateTaskNotification = (taskId: string | null) => {
      if (disposed || !taskId) return
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.details(userId, taskId) })
    }

    const scheduleTransportReconnect = () => {
      if (disposed || reconnectTimer !== null || transportAttempts >= MAX_TRANSPORT_RETRIES || !socket) {
        return
      }
      transportAttempts += 1
      const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (transportAttempts - 1), MAX_RECONNECT_DELAY_MS)
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        if (!disposed) socket?.connect()
      }, delay)
    }

    const recoverAuthentication = async () => {
      if (disposed || authRecoveryInFlight || authRecoveryAttempts >= MAX_AUTH_RECOVERY_ATTEMPTS) {
        return
      }
      authRecoveryAttempts += 1
      authRecoveryInFlight = true
      try {
        const token = await refreshAccessToken(true)
        if (disposed || !socket) return
        socket.auth = { token }
        socket.connect()
      } catch {
        if (!disposed) scheduleTransportReconnect()
      } finally {
        authRecoveryInFlight = false
      }
    }

    socket = createNotificationSocket()

    const handleConnect = () => {
      if (disposed) return
      transportAttempts = 0
      authRecoveryAttempts = 0
      invalidateNotifications()
    }

    const handleConnectError = (error: Error) => {
      if (disposed) return
      if (isSocketAuthenticationError(error)) {
        void recoverAuthentication()
      } else {
        scheduleTransportReconnect()
      }
    }

    const handleDisconnect = (reason: string) => {
      if (disposed || reconnectingForTokenChange) return
      if (reason === 'io server disconnect') {
        void recoverAuthentication()
      } else {
        scheduleTransportReconnect()
      }
    }

    const handleNewNotification = (notification: unknown) => {
      if (!isNotification(notification)) return
      invalidateNotifications()
      invalidateTaskNotification(notification.taskId)
    }

    const handleUnreadCount = (payload: unknown) => {
      if (!isUnreadCountEvent(payload)) return
      void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount(userId) })
    }

    const handleNotificationRead = (payload: unknown) => {
      if (!isNotificationReadEvent(payload)) return
      invalidateNotifications()
    }

    const handleReadAll = (payload: unknown) => {
      if (!isReadAllEvent(payload)) return
      invalidateNotifications()
    }

    socket.on('connect', handleConnect)
    socket.on('connect_error', handleConnectError)
    socket.on('disconnect', handleDisconnect)
    socket.on('notification:new', handleNewNotification)
    socket.on('notifications:unread-count', handleUnreadCount)
    socket.on('notification:read', handleNotificationRead)
    socket.on('notifications:read-all', handleReadAll)

    const unsubscribeToken = subscribeAccessToken((token) => {
      if (disposed || !socket || !socket.connected) return
      reconnectingForTokenChange = true
      if (!token) {
        socket.disconnect()
        reconnectingForTokenChange = false
        return
      }
      socket.auth = { token }
      socket.disconnect()
      reconnectingForTokenChange = false
      socket.connect()
    })

    socket.connect()

    return () => {
      disposed = true
      clearReconnectTimer()
      unsubscribeToken()
      socket?.removeAllListeners()
      socket?.disconnect()
      socket = null
    }
  }, [isAuthenticated, userId])

}
