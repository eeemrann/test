import { api } from '@/lib/api'
import type { Registration, RegistrationsResponse, Team } from '@/features/admin/types/admin.types'

export async function getRegistrations(status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') {
  const response = await api.get<RegistrationsResponse>('/admin/registrations', { params: { status, page: 1, limit: 100 } })
  return response.data
}

export async function approveRegistration(id: string, teamId?: string) {
  const response = await api.patch<Registration>(`/admin/registrations/${id}/approve`, teamId ? { teamId } : {})
  return response.data
}

export async function rejectRegistration(id: string) {
  const response = await api.patch<Registration>(`/admin/registrations/${id}/reject`)
  return response.data
}

export async function getTeams() {
  const response = await api.get<Team[]>('/users/teams')
  return response.data
}
