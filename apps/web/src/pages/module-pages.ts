import {
  Bell,
  CalendarDays,
  FileWarning,
  Megaphone,
  NotebookTabs,
  Settings,
  UsersRound,
} from 'lucide-react'
import type { ComponentProps } from 'react'
import { PlaceholderPage } from '@/layouts/components/placeholder-page'

export const modulePageContent = {
  tasks: {
    title: 'Taskboard',
    description: 'A focused place for team tasks, ownership, priorities, and progress.',
    icon: NotebookTabs,
    eyebrow: 'Main module',
  },
  attendance: {
    title: 'Attendance',
    description: 'Review attendance information and office presence when that workflow is connected.',
    icon: NotebookTabs,
    eyebrow: 'Workplace module',
  },
  leaves: {
    title: 'Leave requests',
    description: 'Follow leave request submissions and decisions in a future workflow.',
    icon: FileWarning,
    eyebrow: 'Workplace module',
  },
  calendar: {
    title: 'Calendar',
    description: 'Keep important office dates and team events together in one view.',
    icon: CalendarDays,
    eyebrow: 'Main module',
  },
  complaints: {
    title: 'Complaints',
    description: 'A private workspace for workplace concerns and their follow-up.',
    icon: UsersRound,
    eyebrow: 'Workplace module',
  },
  announcements: {
    title: 'Announcements',
    description: 'Read and share official office updates when the announcement workflow arrives.',
    icon: Megaphone,
    eyebrow: 'Workplace module',
  },
  notifications: {
    title: 'Notifications',
    description: 'Your personal notification inbox will connect to the backend notification APIs next.',
    icon: Bell,
    eyebrow: 'Personal module',
  },
  settings: {
    title: 'Settings',
    description: 'Workspace preferences and account controls will be added here in a later phase.',
    icon: Settings,
    eyebrow: 'Personal module',
  },
} satisfies Record<string, ComponentProps<typeof PlaceholderPage>>

export { PlaceholderPage }
