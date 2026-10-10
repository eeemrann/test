import { describe, expect, it } from 'vitest'
import { describeTaskActivity } from '@/features/tasks/activity-format'
import type { TaskActivity } from '@/features/tasks/types/task.types'

const activity = (overrides: Partial<TaskActivity>): TaskActivity => ({
  id: 'activity-1', type: 'UPDATED', createdAt: '2026-10-10T10:00:00.000Z',
  actor: { id: 'actor-1', fullName: 'Ada Lovelace', email: 'ada@office.local', role: 'MANAGER', teamId: 'team-1' },
  metadata: null, ...overrides,
})

describe('activity presentation', () => {
  it('describes known status metadata without exposing unrelated values', () => {
    const result = describeTaskActivity(activity({ type: 'STATUS_CHANGED', metadata: { previousStatus: 'PENDING', newStatus: 'WORKING', actorUserId: 'secret-id' } }))
    expect(result.detail).toBe('Status changed from Pending to Working.')
    expect(JSON.stringify(result)).not.toContain('secret-id')
  })

  it('uses truthful generic language for reassignment history', () => {
    const result = describeTaskActivity(activity({ type: 'REASSIGNED', metadata: { previousAssigneeId: 'old-id', newAssigneeId: 'new-id' } }))
    expect(result.detail).toBe('The task assignee changed.')
    expect(JSON.stringify(result)).not.toContain('old-id')
    expect(JSON.stringify(result)).not.toContain('new-id')
  })

  it('only lists approved updated fields and never renders raw metadata', () => {
    const result = describeTaskActivity(activity({ type: 'UPDATED', metadata: { changes: { title: { previous: 'old', next: 'new' }, internalSecret: { previous: 'x', next: 'y' } } } }))
    expect(result.detail).toBe('title updated.')
    expect(JSON.stringify(result)).not.toContain('internalSecret')
    expect(JSON.stringify(result)).not.toContain('old')
  })
})
