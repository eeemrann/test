let accessToken: string | null = null
const accessTokenListeners = new Set<(token: string | null) => void>()

export function getAccessToken(): string | null {
  return accessToken
}

export function activateAccessToken(token: string): void {
  accessToken = token
  accessTokenListeners.forEach((listener) => listener(accessToken))
}

export function clearAccessToken(): void {
  accessToken = null
  accessTokenListeners.forEach((listener) => listener(null))
}

export function subscribeAccessToken(listener: (token: string | null) => void): () => void {
  accessTokenListeners.add(listener)
  return () => accessTokenListeners.delete(listener)
}
