export type AttendanceStatus = 'PRESENT' | 'LATE' | 'MISSED' | 'NOT_CHECKED_IN' | 'CHECKED_OUT' | 'NON_WORKING_DAY' | 'FUTURE' | 'NOT_TRACKED' | 'EXEMPT'

export type AttendanceToday = {
  date: string
  status: AttendanceStatus
  isWorkingDay: boolean
  timezone: string
  officeHours: { start: string; gracePeriodEnds: string }
  checkInAt: string | null
  checkOutAt: string | null
  checkInStatus: 'PRESENT' | 'LATE' | null
}

export type AttendanceSummary = {
  totalPresentDays: number
  totalLateDays: number
  totalMissedDays: number
  totalScheduledWorkingDays: number
  onTimeDays: number
  attendancePercentage: number
}

export type AttendanceHistoryEntry = {
  date: string
  day: string
  status: AttendanceStatus
  checkInAt: string | null
  checkOutAt: string | null
  checkInStatus: 'PRESENT' | 'LATE' | null
}

export type AttendanceMine = {
  data: AttendanceHistoryEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  summary: AttendanceSummary
  timezone: string
  officeHours: { start: string; gracePeriodEnds: string }
}

export type AttendanceOverview = {
  timezone: string
  date: string
  isWorkingDay: boolean
  totalApprovedActiveStaff: number
  checkedInStaff: number
  lateStaff: number
  notYetCheckedIn: number
  monthlySummary: { present: number; late: number; missed: number; scheduled: number }
  staff: Array<{
    id: string
    fullName: string
    email: string
    role: 'EMPLOYEE' | 'MANAGER'
    teamId: string | null
    status: AttendanceStatus
    checkInAt: string | null
    checkOutAt: string | null
  }>
}

export type AttendanceTeam = {
  data: Array<{
    id: string
    date: string
    status: AttendanceStatus
    checkInStatus: 'PRESENT' | 'LATE'
    checkInAt: string
    checkOutAt: string | null
    user: { id: string; fullName: string; email: string; role: 'EMPLOYEE' | 'MANAGER'; teamId: string | null }
  }>
  pagination: { page: number; limit: number; total: number; totalPages: number }
  timezone: string
}
