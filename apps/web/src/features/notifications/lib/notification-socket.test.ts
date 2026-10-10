import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activateAccessToken, clearAccessToken } from '@/features/auth/auth-token'
import { createNotificationSocket, isSocketAuthenticationError } from '@/features/notifications/lib/notification-socket'

const mocks = vi.hoisted(() => ({ io: vi.fn() }))
vi.mock('socket.io-client', () => ({ io: mocks.io }))

describe('notification socket configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAccessToken()
  })

  it('uses handshake auth for the in-memory access token and no query credentials', () => {
    activateAccessToken('memory-only-token')
    const socket = { on: vi.fn(), connect: vi.fn() }
    mocks.io.mockReturnValue(socket)

    createNotificationSocket()

    const options = mocks.io.mock.calls[0]?.[1] as { auth: (callback: (auth: unknown) => void) => void; query?: unknown; reconnection: boolean }
    const authCallback = vi.fn()
    options.auth(authCallback)
    expect(authCallback).toHaveBeenCalledWith({ token: 'memory-only-token' })
    expect(options.query).toBeUndefined()
    expect(options.reconnection).toBe(false)
  })

  it('recognizes authentication errors but not ordinary transport failures', () => {
    expect(isSocketAuthenticationError(new Error('Unauthorized'))).toBe(true)
    expect(isSocketAuthenticationError(new Error('token expired'))).toBe(true)
    expect(isSocketAuthenticationError(new Error('timeout'))).toBe(false)
  })
})
