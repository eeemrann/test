import { api } from '@/lib/api'

export type DatabaseHealthResponse = {
  status: 'ok'
  database: 'connected'
}

export async function getDatabaseHealth(): Promise<DatabaseHealthResponse> {
  const response = await api.get<DatabaseHealthResponse>('/health/database')
  return response.data
}
