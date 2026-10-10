import axios from 'axios'
import { getApiErrorMessage } from '@/lib/api'

export function getTaskMutationErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === 400) return 'Please review the highlighted fields and try again.'
    if (status === 401) return 'Your session has expired. Please sign in again.'
    if (status === 403) return 'You do not have permission to perform this action.'
    if (status === 404) return 'The task or selected employee could not be found. Refresh and try again.'
    if (status === 409) return 'This task changed elsewhere. The latest details have been loaded; review and try again.'
    if (!error.response) return 'The backend is unavailable. Check that the API is running and try again.'
  }
  return getApiErrorMessage(error)
}
