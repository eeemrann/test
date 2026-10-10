import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRealtimeNotifications } from '@/features/notifications/hooks/use-realtime-notifications'
import { queryClient } from '@/lib/query-client'

type Handler = (...args: unknown[]) => void

const mocks = vi.hoisted(() => ({
  sockets: [] as Array<{ connected: boolean; auth?: unknown; handlers: Record<string, Handler>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; removeAllListeners: ReturnType<typeof vi.fn> }>,
  createSocket: vi.fn(),
  refreshAccessToken: vi.fn(),
  subscribeAccessToken: vi.fn(),
}))

vi.mock('@/features/notifications/lib/notification-socket', () => ({
  createNotificationSocket: mocks.createSocket,
  isSocketAuthenticationError: (error: unknown) => error instanceof Error && error.message === 'Unauthorized',
}))
vi.mock('@/lib/api', () => ({ refreshAccessToken: mocks.refreshAccessToken }))
vi.mock('@/features/auth/auth-token', () => ({ subscribeAccessToken: mocks.subscribeAccessToken }))

function Probe({ userId, authenticated }: { userId?: string; authenticated: boolean }) {
  useRealtimeNotifications({ userId, isAuthenticated: authenticated })
  return null
}

function makeSocket() {
  const socket = {
    connected: false,
    auth: undefined as unknown,
    handlers: {} as Record<string, Handler>,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  }
  socket.on.mockImplementation((event: string, handler: Handler) => {
    socket.handlers[event] = handler
    return socket
  })
  socket.connect.mockImplementation(() => {
    socket.connected = true
    socket.handlers.connect?.()
  })
  socket.disconnect.mockImplementation(() => { socket.connected = false })
  return socket
}

describe('realtime notification lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sockets.length = 0
    mocks.refreshAccessToken.mockResolvedValue('refreshed-token')
    mocks.subscribeAccessToken.mockReturnValue(vi.fn())
    mocks.createSocket.mockImplementation(() => {
      const socket = makeSocket()
      mocks.sockets.push(socket)
      return socket
    })
  })

  it('does not create a socket before authentication and disconnects on unmount', () => {
    const rendered = render(<Probe authenticated={false} />)
    expect(mocks.createSocket).not.toHaveBeenCalled()

    rendered.rerender(<Probe authenticated userId="user-1" />)
    expect(mocks.createSocket).toHaveBeenCalledOnce()
    const socket = mocks.sockets[0]!
    expect(socket.connect).toHaveBeenCalledOnce()

    rendered.unmount()
    expect(socket.removeAllListeners).toHaveBeenCalledOnce()
    expect(socket.disconnect).toHaveBeenCalledOnce()
  })

  it('refreshes through the existing session mechanism after an authenticated socket failure', async () => {
    render(<Probe authenticated userId="user-1" />)
    const socket = mocks.sockets[0]!

    await act(async () => {
      socket.handlers.connect_error?.(new Error('Unauthorized'))
    })

    expect(mocks.refreshAccessToken).toHaveBeenCalledWith(true)
    expect(socket.auth).toEqual({ token: 'refreshed-token' })
    expect(socket.connect).toHaveBeenCalledTimes(2)
  })

  it('does not leave duplicate live sockets in Strict Mode or after an account switch', () => {
    const rendered = render(<StrictMode><Probe authenticated userId="user-1" /></StrictMode>)
    expect(mocks.sockets.filter((socket) => socket.connected)).toHaveLength(1)
    expect(mocks.sockets[0]?.disconnect).toHaveBeenCalledOnce()

    rendered.rerender(<StrictMode><Probe authenticated userId="user-2" /></StrictMode>)
    expect(mocks.sockets[0]?.disconnect).toHaveBeenCalled()
    expect(mocks.sockets.filter((socket) => socket.connected)).toHaveLength(1)
  })

  it('invalidates private notification and task caches for valid incoming events', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    render(<Probe authenticated userId="user-1" />)
    const socket = mocks.sockets[0]!

    await act(async () => {
      socket.handlers['notification:new']?.({ id: 'notification-1', type: 'TASK_ASSIGNED', title: 'Assigned', message: 'New work', taskId: 'task-1', readAt: null, createdAt: '2026-10-11T00:00:00.000Z' })
      socket.handlers['notifications:unread-count']?.({ count: 1 })
    })

    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['notifications', 'user-1'] }))
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['notifications', 'user-1', 'unread-count'] }))
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['tasks', 'user-1'] }))
    invalidate.mockRestore()
  })
})
