# Office Management demo walkthrough

## Start the local stack

From the repository root:

```bash
docker compose up -d
cd apps/api
npm run start:dev
```

In a second terminal:

```bash
cd apps/web
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open <http://localhost:5173>. Keep local credentials in the ignored `apps/api/.env` file; do not place passwords or tokens in this document.

## Suggested live presentation

1. Open the login page and sign in as an existing approved Employee.
2. Show the dashboard, role identity, team information, sidebar and responsive navigation.
3. Open Taskboard and create a task assigned to another active Employee.
4. Show the task in Pending, then move it through the allowed Working and Done states.
5. Open task details to show creator, assignee, priority, deadline, completed time and activity history.
6. Use search, priority/assignee/deadline filters, sort controls and per-column pagination.
7. Open Notifications and mark an item read, or use Mark all read.
8. In a second browser context, show the assigned Employee receiving the live notification and the unread badge updating.
9. Sign in as a Manager to demonstrate team-scoped reassignment.
10. Sign in as an Admin to demonstrate cross-team reassignment and backend-supported status correction.
11. Visit Attendance as the Employee. Show today’s state, the 10:00 AM office start, the 10:15 AM late threshold, the personal history table, and the Present/Late/Missed summary cards. Perform check-in and checkout only when the owner has approved a normal-database mutation for the demonstration.
12. Sign in as a Manager to show team-scoped attendance records, then as an ADMIN to show office-wide attendance and the Registration approvals page.
13. Visit the profile page and sign out from the profile menu.
14. Explain that Leave Requests, Complaints, Announcements, Calendar and Settings remain placeholder modules.

## Functional boundaries

Fully functional today: authentication and refresh sessions, public registration, admin approval/rejection, role-aware application layout, task creation/editing/status/reassignment, drag-and-drop taskboard behavior, activity history, server-backed filters and pagination, notification inbox, mark-read actions, authenticated Socket.IO notification updates, employee attendance check-in/out, monthly personal summaries, manager team reporting, and admin office-wide reporting.

Placeholders by design: leave requests, calendar, complaints, announcements and settings business workflows. They must not be presented as implemented backend modules.

## Role and attendance talking points

Assignment permissions are enforced by the API:

| Actor | Allowed assignee roles |
| --- | --- |
| ADMIN | ADMIN, MANAGER, EMPLOYEE |
| MANAGER | ADMIN, EMPLOYEE |
| EMPLOYEE | EMPLOYEE |

Reassignment has separate ownership and team restrictions. An assigned manager or admin can progress their own assigned task without gaining access to unrelated users’ tasks.

Attendance uses server time in `Asia/Dhaka`. The default office start is 10:00 AM; exactly 10:15 AM is on time and arrivals after 10:15 AM are late. Late days are included in Present, holidays and non-working days are excluded, and the current unfinished day is not counted as missed. ADMIN accounts are exempt from daily attendance.

## Manual normal-database acceptance

The following actions are intentionally not automated by the release preparation agent:

1. Register a new employee with a unique email.
2. Confirm pending status and pending-login rejection.
3. Approve the registration as ADMIN and optionally assign a team.
4. Log in as the approved employee, check in once, check out once, reload, and verify the persisted summary/history.
5. Verify the Manager team view and ADMIN office-wide view.
6. Verify the task assignment matrix and reassignment restrictions using dedicated demonstration tasks.

Do not report these scenarios as manually accepted until the owner performs and confirms them. Never use the normal database for automated mutation tests.

## Browser verification

Install dependencies once, then run:

```bash
npm run test:e2e
```

Public and responsive checks run without database mutations. Live authentication, task mutation, role-permission, drag-and-drop and realtime notification checks require explicit ignored environment variables and an isolated test database. Set `E2E_ENABLE_AUTH=true`, `E2E_ENABLE_MUTATIONS=true`, `E2E_ISOLATED_DATABASE=true`, and the `E2E_*` account variables only when the backend is pointed at that isolated database. Never point mutation tests at `office_management`.

## Isolated browser acceptance

The Phase 7.8 browser suite uses a separate PostgreSQL database and ports. It refuses non-loopback URLs and any database name other than `office_management_e2e`.

From `apps/api`, configure `E2E_DATABASE_URL` and the three E2E password variables using ignored local environment files or exported variables. Passwords must be at least 16 characters and must not be committed.

From `apps/web`, run:

```bash
E2E_ENABLE_AUTH=true E2E_ENABLE_MUTATIONS=true E2E_ISOLATED_DATABASE=true \
E2E_BASE_URL=http://127.0.0.1:5175 E2E_API_BASE_URL=http://127.0.0.1:3002 \
npm run test:e2e
```

The Playwright configuration starts the isolated backend on port 3002 and Vite on port 5175. Its setup applies the existing migration, seeds seven isolated accounts, and only the scoped cleanup command may remove acceptance task fixtures:

```bash
cd apps/api
npm run db:e2e:cleanup
```

The normal development server and `office_management` database are not used by mutation tests.
