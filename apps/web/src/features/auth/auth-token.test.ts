import { beforeEach, describe, expect, it } from 'vitest'
import {
  activateAccessToken,
  clearAccessToken,
  getAccessToken,
} from '@/features/auth/auth-token'

describe('in-memory access token store', () => {
  beforeEach(() => {
    clearAccessToken()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stores and clears tokens only in memory', () => {
    expect(getAccessToken()).toBeNull()

    activateAccessToken('memory-token')

    expect(getAccessToken()).toBe('memory-token')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)

    clearAccessToken()

    expect(getAccessToken()).toBeNull()
  })
})
