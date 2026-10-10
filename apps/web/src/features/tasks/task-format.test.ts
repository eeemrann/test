import { describe, expect, it } from 'vitest'
import { getDeadlineRangeError, toApiDateBoundary } from '@/features/tasks/task-format'

describe('task filter date helpers', () => {
  it('creates timezone-aware start and end boundaries', () => {
    expect(toApiDateBoundary('2026-10-10')).toBe(new Date('2026-10-10T00:00:00').toISOString())
    expect(toApiDateBoundary('2026-10-10', true)).toBe(new Date('2026-10-10T23:59:59.999').toISOString())
  })

  it('rejects an inverted deadline range', () => {
    expect(getDeadlineRangeError('2026-10-11T00:00:00.000Z', '2026-10-10T23:59:59.999Z')).toBeTruthy()
    expect(getDeadlineRangeError('2026-10-10T00:00:00.000Z', '2026-10-11T23:59:59.999Z')).toBeNull()
  })
})
