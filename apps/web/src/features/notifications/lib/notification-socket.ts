import { io, type Socket } from 'socket.io-client'
import { apiBaseUrl } from '@/lib/api'
import { getAccessToken } from '@/features/auth/auth-token'

export type NotificationSocket = Socket

export function createNotificationSocket(): NotificationSocket {
  return io(apiBaseUrl, {
    autoConnect: false,
    reconnection: false,
    withCredentials: true,
    auth: (callback) => {
      callback({ token: getAccessToken() ?? '' })
    },
  })
}

export function isSocketAuthenticationError(error: unknown): boolean {
  const message = typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : ''
  const normalized = message.toLowerCase()
  return normalized.includes('unauthorized') || normalized.includes('authentication') || normalized.includes('token expired')
}
