import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AttendancePage } from '@/pages/attendance-page'
import type { AttendanceMine, AttendanceOverview, AttendanceTeam, AttendanceToday } from '@/features/attendance/types/attendance.types'

const mocks = vi.hoisted(() => ({
  auth: {
    currentUser: {
      id: 'employee-1', fullName: 'Employee One', email: 'employee@office.local', role: 'EMPLOYEE' as 'EMPLOYEE' | 'MANAGER' | 'ADMIN', teamId: 'team-1', isActive: true,
    },
  },
  getAttendanceToday: vi.fn(),
  checkIn: vi.fn(),
  checkOut: vi.fn(),
  getMyAttendance: vi.fn(),
  getAttendanceOverview: vi.fn(),
  getTeamAttendance: vi.fn(),
  getApiErrorMessage: vi.fn(() => 'Attendance backend unavailable.'),
}))

vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/features/attendance/api/attendance-api', () => ({
  getAttendanceToday: mocks.getAttendanceToday,
  checkIn: mocks.checkIn,
  checkOut: mocks.checkOut,
  getMyAttendance: mocks.getMyAttendance,
  getAttendanceOverview: mocks.getAttendanceOverview,
  getTeamAttendance: mocks.getTeamAttendance,
}))
vi.mock('@/lib/api', () => ({ getApiErrorMessage: mocks.getApiErrorMessage }))

const today: AttendanceToday = {
  date: '2026-10-11', status: 'NOT_CHECKED_IN', isWorkingDay: true, timezone: 'Asia/Dhaka',
  officeHours: { start: '10:00', gracePeriodEnds: '10:15' }, checkInAt: null, checkOutAt: null, checkInStatus: null,
}

const mine: AttendanceMine = {
  data: [
    { date: '2026-10-01', day: 'Thursday', status: 'PRESENT', checkInAt: '2026-10-01T04:00:00.000Z', checkOutAt: null, checkInStatus: 'PRESENT' },
    { date: '2026-10-02', day: 'Friday', status: 'NON_WORKING_DAY', checkInAt: null, checkOutAt: null, checkInStatus: null },
  ],
  pagination: { page: 1, limit: 40, total: 2, totalPages: 1 },
  summary: { totalPresentDays: 1, totalLateDays: 0, totalMissedDays: 0, totalScheduledWorkingDays: 1, onTimeDays: 1, attendancePercentage: 100 },
  timezone: 'Asia/Dhaka', officeHours: { start: '10:00', gracePeriodEnds: '10:15' },
}

const overview: AttendanceOverview = {
  timezone: 'Asia/Dhaka', date: '2026-10-11', isWorkingDay: true, totalApprovedActiveStaff: 2, checkedInStaff: 1, lateStaff: 0, notYetCheckedIn: 1,
  monthlySummary: { present: 1, late: 0, missed: 0, scheduled: 1 },
  staff: [{ id: 'employee-1', fullName: 'Employee One', email: 'employee@office.local', role: 'EMPLOYEE', teamId: 'team-1', status: 'PRESENT', checkInAt: '2026-10-11T04:00:00.000Z', checkOutAt: null }],
}

const team: AttendanceTeam = {
  data: [{ id: 'attendance-1', date: '2026-10-11', status: 'PRESENT', checkInStatus: 'PRESENT', checkInAt: '2026-10-11T04:00:00.000Z', checkOutAt: null, user: { id: 'employee-1', fullName: 'Employee One', email: 'employee@office.local', role: 'EMPLOYEE', teamId: 'team-1' } }],
  pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  timezone: 'Asia/Dhaka',
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AttendancePage />
    </QueryClientProvider>,
  )
}

describe('attendance page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.currentUser = { ...mocks.auth.currentUser, role: 'EMPLOYEE' }
    mocks.getAttendanceToday.mockResolvedValue(today)
    mocks.checkIn.mockResolvedValue({ ...today, status: 'PRESENT', checkInStatus: 'PRESENT', checkInAt: '2026-10-11T04:00:00.000Z' })
    mocks.checkOut.mockResolvedValue({ ...today, status: 'CHECKED_OUT', checkInStatus: 'PRESENT' })
    mocks.getMyAttendance.mockResolvedValue(mine)
    mocks.getAttendanceOverview.mockResolvedValue(overview)
    mocks.getTeamAttendance.mockResolvedValue(team)
  })

  it('renders real attendance summary/history data and refreshes after check-in', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Present days')).toBeInTheDocument()
    expect(screen.getByText('Monthly history')).toBeInTheDocument()
    expect(screen.getByText('Non Working Day')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Check in/ }))

    await waitFor(() => expect(mocks.checkIn).toHaveBeenCalledOnce())
    expect(mocks.getAttendanceToday).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Present')).toBeInTheDocument()
  })

  it('uses server office hours and explains that late days count as present', async () => {
    mocks.getAttendanceToday.mockResolvedValue({
      ...today,
      officeHours: { start: '09:30', gracePeriodEnds: '10:15' },
    })
    mocks.getMyAttendance.mockResolvedValue({
      ...mine,
      officeHours: { start: '09:30', gracePeriodEnds: '10:15' },
      summary: { ...mine.summary, totalPresentDays: 2, totalLateDays: 1, onTimeDays: 1 },
    })

    renderPage()

    expect(await screen.findByText('9:30 AM')).toBeInTheDocument()
    expect(screen.getByText('1 late included')).toBeInTheDocument()
    expect(screen.getByText('Also counted as present')).toBeInTheDocument()
  })

  it('shows manager team attendance and admin office overview from the API', async () => {
    mocks.auth.currentUser = { ...mocks.auth.currentUser, role: 'MANAGER' }
    renderPage()
    expect(await screen.findByText('Team attendance records')).toBeInTheDocument()
    expect(screen.getByText('Employee One')).toBeInTheDocument()

    cleanup()
    mocks.auth.currentUser = { ...mocks.auth.currentUser, role: 'ADMIN' }
    renderPage()
    expect(await screen.findByText('Staff observation')).toBeInTheDocument()
    expect(screen.getByText('Approved active staff')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Check in/ })).not.toBeInTheDocument()
  })

  it('shows a retryable backend error instead of fabricated attendance data', async () => {
    mocks.getAttendanceToday.mockRejectedValue(new Error('offline'))
    mocks.getMyAttendance.mockRejectedValue(new Error('offline'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Attendance backend unavailable.')
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument()
    expect(screen.queryByText('Present days')).not.toBeInTheDocument()
  })
})
