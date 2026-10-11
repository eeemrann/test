export const AUTH_ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN'] as const

export type UserRole = (typeof AUTH_ROLES)[number]

export type LoginCredentials = {
  email: string
  password: string
}

export type LoginUser = {
  id: string
  fullName: string
  email: string
  role: UserRole
  teamId: string | null
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export type AuthUser = LoginUser & {
  isActive: boolean
}

export type LoginResponse = {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: 900
  user: LoginUser
}

export type RegistrationInput = {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export type AuthStatus =
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated'
  | 'unavailable'

export type LogoutResult = {
  serverRevoked: boolean
  warning?: string
}
