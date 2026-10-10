import { useQuery } from '@tanstack/react-query'
import {
  getDatabaseHealth,
  type DatabaseHealthResponse,
} from '@/features/health/api'

export function useDatabaseHealth() {
  return useQuery<DatabaseHealthResponse>({
    queryKey: ['database-health'],
    queryFn: getDatabaseHealth,
  })
}
