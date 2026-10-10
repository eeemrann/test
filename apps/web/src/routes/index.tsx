import { Route, Routes } from 'react-router-dom'
import { GuestRoute } from '@/features/auth/components/guest-route'
import { ProtectedRoute } from '@/features/auth/components/protected-route'
import { AppLayout } from '@/layouts/app-layout'
import { AppPage } from '@/pages/app-page'
import { LoginPage } from '@/pages/login-page'
import { modulePageContent, PlaceholderPage } from '@/pages/module-pages'
import { NotFoundPage } from '@/pages/not-found-page'
import { ProfilePage } from '@/pages/profile-page'
import { SetupPage } from '@/pages/setup-page'
import { TaskboardPage } from '@/pages/taskboard-page'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<SetupPage />} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppPage />} />
          <Route path="/app/tasks" element={<TaskboardPage />} />
          <Route path="/app/attendance" element={<PlaceholderPage {...modulePageContent.attendance} />} />
          <Route path="/app/leaves" element={<PlaceholderPage {...modulePageContent.leaves} />} />
          <Route path="/app/calendar" element={<PlaceholderPage {...modulePageContent.calendar} />} />
          <Route path="/app/complaints" element={<PlaceholderPage {...modulePageContent.complaints} />} />
          <Route path="/app/announcements" element={<PlaceholderPage {...modulePageContent.announcements} />} />
          <Route path="/app/notifications" element={<PlaceholderPage {...modulePageContent.notifications} />} />
          <Route path="/app/profile" element={<ProfilePage />} />
          <Route path="/app/settings" element={<PlaceholderPage {...modulePageContent.settings} />} />
          <Route path="/app/*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
