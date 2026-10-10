import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api, activateSession, invalidateSession } from '@/lib/api'

function response<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config,
  }
}

function requestError(config: InternalAxiosRequestConfig, status: number): AxiosError {
  return new AxiosError(
    `HTTP ${status}`,
    status === 401 ? 'ERR_BAD_REQUEST' : 'ERR_BAD_RESPONSE',
    config,
    undefined,
    response(config, null, status),
  )
}

describe('authenticated Axios client', () => {
  const originalAdapter = api.defaults.adapter

  beforeEach(() => {
    invalidateSession()
    activateSession('old-token')
  })

  afterEach(() => {
    api.defaults.adapter = originalAdapter
    invalidateSession()
  })

  it('deduplicates concurrent refresh requests and retries both callers once', async () => {
    let refreshCalls = 0
    let privateCalls = 0

    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return response(config, { accessToken: 'new-token' })
      }

      if (config.url === '/private') {
        privateCalls += 1
        const authorization = config.headers.get('Authorization')

        if (authorization === 'Bearer old-token') {
          return Promise.reject(requestError(config, 401))
        }

        return response(config, { ok: true })
      }

      return response(config, {})
    }

    const results = await Promise.all([api.get('/private'), api.get('/private')])

    expect(results).toHaveLength(2)
    expect(refreshCalls).toBe(1)
    expect(privateCalls).toBe(4)
  })

  it('does not refresh a request that returns 403', async () => {
    let refreshCalls = 0

    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls += 1
        return response(config, { accessToken: 'unexpected-token' })
      }

      return Promise.reject(requestError(config, 403))
    }

    await expect(api.get('/private')).rejects.toMatchObject({
      response: { status: 403 },
    })
    expect(refreshCalls).toBe(0)
  })

  it('does not refresh failed login requests', async () => {
    let refreshCalls = 0

    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls += 1
        return response(config, { accessToken: 'unexpected-token' })
      }

      return Promise.reject(requestError(config, 401))
    }

    await expect(
      api.post('/auth/login', { email: 'user@office.local', password: 'not-real' }, {
        skipAuthHeader: true,
        skipAuthRefresh: true,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshCalls).toBe(0)
  })

  it('retries an expired request at most once', async () => {
    let refreshCalls = 0
    let privateCalls = 0

    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls += 1
        return response(config, { accessToken: 'new-token' })
      }

      privateCalls += 1
      return Promise.reject(requestError(config, 401))
    }

    await expect(api.get('/private')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(refreshCalls).toBe(1)
    expect(privateCalls).toBe(2)
  })

  it('never persists access tokens in browser storage', () => {
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(sessionStorage.getItem('accessToken')).toBeNull()
  })
})
