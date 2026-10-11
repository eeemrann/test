import { api } from '@/lib/api'
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  RegistrationInput,
} from '@/features/auth/types/auth.types'

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', credentials, {
      skipAuthHeader: true,
      skipAuthRefresh: true,
    })
    return response.data
  },

  async getCurrentUser(): Promise<AuthUser> {
    const response = await api.get<AuthUser>('/auth/me', {
      skipAuthRefresh: true,
    })
    return response.data
  },

  async register(input: RegistrationInput): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/register', input, {
      skipAuthHeader: true,
      skipAuthRefresh: true,
    })
    return response.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout', undefined, {
      skipAuthHeader: true,
      skipAuthRefresh: true,
    })
  },
}
