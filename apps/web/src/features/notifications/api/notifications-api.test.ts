import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from '@/features/notifications/api/notifications-api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }))

const mockedGet = vi.mocked(api.get)
const mockedPatch = vi.mocked(api.patch)

describe('notifications API integration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists private notifications with the backend pagination and unreadOnly contract', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [], pagination: { page: 2, limit: 20, total: 0, totalPages: 0 } } })

    await getNotifications({ page: 2, limit: 20, unreadOnly: true })

    expect(mockedGet).toHaveBeenCalledWith('/notifications', { params: { page: 2, limit: 20, unreadOnly: true } })
    expect(JSON.stringify(mockedGet.mock.calls)).not.toContain('recipientUserId')
  })

  it('loads unread count and maps both read mutations exactly', async () => {
    mockedGet.mockResolvedValueOnce({ data: { count: 3 } })
    mockedPatch.mockResolvedValueOnce({ data: { id: 'notification-1', readAt: '2026-10-11T00:00:00.000Z' } }).mockResolvedValueOnce({ data: { updatedCount: 2 } })

    await getUnreadCount()
    await markNotificationRead('notification-1')
    await markAllNotificationsRead()

    expect(mockedGet).toHaveBeenCalledWith('/notifications/unread-count')
    expect(mockedPatch).toHaveBeenNthCalledWith(1, '/notifications/notification-1/read')
    expect(mockedPatch).toHaveBeenNthCalledWith(2, '/notifications/read-all')
  })
})
