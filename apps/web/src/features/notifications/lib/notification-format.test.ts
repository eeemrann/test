import { describe, expect, it } from 'vitest'
import { formatNotificationTime, getNotificationTypeLabel, isUnreadNotification } from '@/features/notifications/lib/notification-format'

describe('notification formatting', () => {
  it('formats known notification types and relative times', () => {
    expect(getNotificationTypeLabel('TASK_ASSIGNED')).toBe('Task assigned')
    expect(formatNotificationTime('2026-10-11T11:59:30.000Z', new Date('2026-10-11T12:00:00.000Z'))).toBe('Just now')
    expect(formatNotificationTime('2026-10-11T11:55:00.000Z', new Date('2026-10-11T12:00:00.000Z'))).toBe('5m ago')
  })

  it('uses the server readAt value as the only source of read state', () => {
    expect(isUnreadNotification({ readAt: null })).toBe(true)
    expect(isUnreadNotification({ readAt: '2026-10-11T12:00:00.000Z' })).toBe(false)
  })
})
