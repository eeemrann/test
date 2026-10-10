import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  Megaphone,
  NotebookTabs,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react'
import type { UserRole } from '@/features/auth/types/auth.types'

export type NavigationItem = {
  label: string
  to: string
  icon: LucideIcon
  description: string
  roles?: readonly UserRole[]
}

export type NavigationGroup = {
  label: string
  items: readonly NavigationItem[]
}

export const navigationGroups: readonly NavigationGroup[] = [
  {
    label: 'Main',
    items: [
      {
        label: 'Dashboard',
        to: '/app',
        icon: LayoutDashboard,
        description: 'Your office workspace overview',
      },
      {
        label: 'Taskboard',
        to: '/app/tasks',
        icon: ClipboardList,
        description: 'Coordinate tasks and priorities',
      },
      {
        label: 'Calendar',
        to: '/app/calendar',
        icon: CalendarDays,
        description: 'Keep track of important dates',
      },
    ],
  },
  {
    label: 'Workplace',
    items: [
      {
        label: 'Attendance',
        to: '/app/attendance',
        icon: NotebookTabs,
        description: 'Review attendance information',
      },
      {
        label: 'Leave Requests',
        to: '/app/leaves',
        icon: FileWarning,
        description: 'Follow leave request progress',
      },
      {
        label: 'Complaints',
        to: '/app/complaints',
        icon: UsersRound,
        description: 'Raise and follow workplace concerns',
      },
      {
        label: 'Announcements',
        to: '/app/announcements',
        icon: Megaphone,
        description: 'Read office announcements',
      },
    ],
  },
  {
    label: 'Personal',
    items: [
      {
        label: 'Notifications',
        to: '/app/notifications',
        icon: Bell,
        description: 'Review your notifications',
      },
      {
        label: 'My Profile',
        to: '/app/profile',
        icon: UserRound,
        description: 'View your account information',
      },
      {
        label: 'Settings',
        to: '/app/settings',
        icon: Settings,
        description: 'Manage workspace preferences',
      },
    ],
  },
]

export function getVisibleNavigation(role: UserRole | null): readonly NavigationGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || (role !== null && item.roles.includes(role))),
    }))
    .filter((group) => group.items.length > 0)
}

export function getNavigationItem(pathname: string): NavigationItem | null {
  const items = navigationGroups.flatMap((group) => group.items)
  return items
    .filter((item) => pathname === item.to || (item.to !== '/app' && pathname.startsWith(`${item.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0] ?? null
}
