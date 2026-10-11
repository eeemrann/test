import { api } from '@/lib/api'
import type { AttendanceMine, AttendanceOverview, AttendanceTeam, AttendanceToday } from '@/features/attendance/types/attendance.types'

export async function getAttendanceToday() {
  const response = await api.get<AttendanceToday>('/attendance/today')
  return response.data
}

export async function checkIn() {
  const response = await api.post<AttendanceToday>('/attendance/check-in')
  return response.data
}

export async function checkOut() {
  const response = await api.post<AttendanceToday>('/attendance/check-out')
  return response.data
}

export async function getMyAttendance(month: string) {
  const response = await api.get<AttendanceMine>('/attendance/me', { params: { month, page: 1, limit: 40 } })
  return response.data
}

export async function getAttendanceOverview(month: string) {
  const response = await api.get<AttendanceOverview>('/attendance/overview', { params: { month } })
  return response.data
}

export async function getTeamAttendance(month: string) {
  const response = await api.get<AttendanceTeam>('/attendance/team', { params: { month, page: 1, limit: 100 } })
  return response.data
}
