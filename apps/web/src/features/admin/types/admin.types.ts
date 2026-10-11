export type Registration = {
  id: string
  fullName: string
  email: string
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  isActive: boolean
  teamId: string | null
  team: { id: string; name: string } | null
  createdAt: string
  approvedAt: string | null
  rejectedAt: string | null
}

export type RegistrationsResponse = {
  data: Registration[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export type Team = { id: string; name: string }
