import axios from 'axios'
import { getApiErrorMessage } from '@/lib/api'

export function getNotificationMutationErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.response?.status === 404) return 'This notification is no longer available.'
    if (!error.response) return 'The backend is unavailable. Try again when the connection is restored.'
  }
  return getApiErrorMessage(error)
}
