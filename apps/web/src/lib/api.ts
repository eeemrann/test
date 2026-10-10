import axios, { type AxiosError } from 'axios'
import {
  activateAccessToken,
  clearAccessToken,
  getAccessToken,
} from '@/features/auth/auth-token'

declare module 'axios' {
  interface AxiosRequestConfig {
    _authRetry?: boolean
    skipAuthHeader?: boolean
    skipAuthRefresh?: boolean
  }
}

export const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const AUTH_ENDPOINTS = ['/auth/login', '/auth/logout', '/auth/refresh']

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 8_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})

let refreshPromise: Promise<string> | null = null
let authFailureListener: (() => void) | null = null
let authGeneration = 0
let refreshEnabled = true

export function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

export function registerAuthFailureListener(listener: () => void): () => void {
  authFailureListener = listener

  return () => {
    if (authFailureListener === listener) {
      authFailureListener = null
    }
  }
}

export function activateSession(accessToken: string): void {
  refreshEnabled = true
  activateAccessToken(accessToken)
}

export function invalidateSession(): void {
  authGeneration += 1
  refreshEnabled = false
  clearAccessToken()
}

export async function refreshAccessToken(force = false): Promise<string> {
  if (!force && !refreshEnabled) {
    throw new Error('Authentication session is inactive')
  }

  if (refreshPromise) {
    return refreshPromise
  }

  const requestGeneration = authGeneration
  refreshPromise = (async () => {
    try {
      const response = await api.post<{ accessToken: string }>(
        '/auth/refresh',
        undefined,
        {
          skipAuthHeader: true,
          skipAuthRefresh: true,
        },
      )

      if (requestGeneration !== authGeneration) {
        throw new Error('Authentication session was invalidated')
      }

      activateSession(response.data.accessToken)
      return response.data.accessToken
    } catch (error) {
      if (isUnauthorizedError(error) && requestGeneration === authGeneration) {
        invalidateSession()
        authFailureListener?.()
      }

      throw error
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken()

  if (accessToken && !config.skipAuthHeader) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config
    const requestUrl = request?.url ?? ''
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) =>
      requestUrl.endsWith(endpoint),
    )

    if (
      error.response?.status !== 401 ||
      !request ||
      request._authRetry ||
      request.skipAuthRefresh ||
      isAuthEndpoint ||
      !refreshEnabled ||
      !getAccessToken()
    ) {
      return Promise.reject(error)
    }

    request._authRetry = true

    try {
      const accessToken = await refreshAccessToken()
      request.headers.set('Authorization', `Bearer ${accessToken}`)
      return api(request)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'The backend is unavailable. Check that the API is running and try again.'
    }

    if (typeof error.response.data?.message === 'string') {
      return error.response.data.message
    }

    return `The backend returned an error (${error.response.status}).`
  }

  return 'An unexpected error occurred while contacting the backend.'
}
