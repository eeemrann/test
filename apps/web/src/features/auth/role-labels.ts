import type { UserRole } from '@/features/auth/types/auth.types'

export const roleLabels: Record<UserRole, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  ADMIN: 'Administrator',
}

export function getRoleLabel(role: UserRole): string {
  return roleLabels[role]
}
