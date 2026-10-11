# Office Management System

Office Management is a role-aware workplace application for authentication, employee registration and approval, task coordination, notifications, and attendance. The repository contains a NestJS API and a React/Vite web client backed by PostgreSQL.

## Release status

The implemented release scope is ready for manual acceptance and Git release preparation. The automated verification baseline is:

- API unit tests: 153 passed
- Backend isolated E2E tests: 61 passed
- Web tests: 68 passed
- Playwright browser tests: 21 passed
- API and web builds: passed
- API and web lint: passed with zero web warnings

The normal `office_management` database has migrations `0000_initial_office_schema` and `0001_registration_attendance_task_permissions` applied. Phase 11 does not modify normal application data.

## Technology and architecture

- API: NestJS, TypeScript, Drizzle ORM, PostgreSQL, JWT, bcryptjs, Socket.IO
- Web: React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, dnd-kit
- Testing: Vitest, Supertest, Testing Library, Playwright, Chromium
- Local database: PostgreSQL 17 through Docker Compose

The API owns validation, authentication, authorization, task rules, registration state, attendance calculations, persistence, and realtime notification delivery. The web client consumes those APIs and does not fabricate attendance or task statistics.

Important directories:

```text
apps/api/src/auth             authentication and refresh sessions
apps/api/src/admin            registration approval and audit actions
apps/api/src/authorization    role guards and permission helpers
apps/api/src/tasks            taskboard, assignment, status, history
apps/api/src/attendance       check-in/out and attendance reporting
apps/api/src/notifications    notification APIs and realtime events
apps/api/drizzle              committed database migrations
apps/api/test                 isolated backend E2E setup and tests
apps/web/src/features         frontend feature modules
apps/web/src/pages             routed application pages
apps/web/e2e                  Playwright browser coverage
```

## Local setup

Requirements:

- Node.js compatible with the project toolchain
- npm
- Docker and Docker Compose
- PostgreSQL client tools for backup and restore

1. Create the local Docker secret file from the example without committing it:

   ```bash
   cp .env.example .env
   # Set POSTGRES_PASSWORD locally.
   ```

2. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

3. Create `apps/api/.env` from `apps/api/.env.example` and set local values. Create `apps/web/.env` from `apps/web/.env.example` when the API is not using its default URL. Never commit either file.

4. Install dependencies and apply migrations from the API directory:

   ```bash
   cd apps/api
   npm install
   npx drizzle-kit migrate --config=drizzle.config.ts
   cd ../web
   npm install
   ```

5. Start the applications in separate terminals:

   ```bash
   # API
   cd apps/api && npm run start:dev

   # Web
   cd apps/web && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
   ```

Open <http://localhost:5173>.

The guarded demo seed is optional and is only allowed for the local development database when `SEED_DEMO_DATA=true`, `NODE_ENV` is not production, and all seed passwords are strong. Do not use it as a production deployment step.

## Environment variables

Use the example files for structure and keep values private.

API variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_ACCESS_SECRET` | Access-token signing secret; at least 32 characters |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-session lifetime |
| `FRONTEND_URL` | Explicit comma-separated CORS origin allowlist |
| `OFFICE_TIMEZONE` | Attendance timezone; default `Asia/Dhaka` |
| `OFFICE_WORKDAYS` | Numeric weekdays, Sunday `0` through Saturday `6` |
| `OFFICE_HOLIDAYS` | Configured holiday dates |
| `OFFICE_START_TIME` | Office start time; default `10:00` |
| `OFFICE_GRACE_END_TIME` | Late threshold; default `10:15` |
| `SEED_DEMO_DATA` | Explicit opt-in for guarded local demo seeding |
| `SEED_ADMIN_PASSWORD` | Local demo ADMIN password |
| `SEED_MANAGER_PASSWORD` | Local demo MANAGER password |
| `SEED_EMPLOYEE_PASSWORD` | Local demo EMPLOYEE password |

Web variable:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL used by the web client |

## Registration and approval

1. Anyone can submit the public registration form.
2. New registrations are created as active `EMPLOYEE` users with `PENDING` approval.
3. Pending and rejected users cannot log in.
4. An ADMIN can review pending, approved, and rejected registrations, optionally assign a team, and approve or reject the account.
5. Approval creates the eligibility start date and records an audit entry.
6. Duplicate email registration is rejected.

The server controls role assignment; the browser cannot promote a registrant to MANAGER or ADMIN.

## Roles and task permissions

Task creation and assignment follow this matrix:

| Actor | Allowed assignee roles | Forbidden assignee roles |
| --- | --- | --- |
| ADMIN | ADMIN, MANAGER, EMPLOYEE | none |
| MANAGER | ADMIN, EMPLOYEE | MANAGER |
| EMPLOYEE | EMPLOYEE | ADMIN, MANAGER |

An assigned MANAGER or ADMIN may progress their own assigned task according to the server’s status rules, but cannot use that permission to access or mutate unrelated users’ tasks. Reassignment remains separately protected: ADMIN can reassign across teams; MANAGER can reassign only within the permitted team/role scope and cannot reassign arbitrary tasks; EMPLOYEE cannot reassign.

Taskboard functionality includes creation, editing, assignment, reassignment, filtering, sorting, pagination, Kanban drag-and-drop, status progression, activity history, and task notifications.

## Attendance policy and calculations

- Default timezone: `Asia/Dhaka`
- Office start: `10:00 AM`
- Check-in at or before `10:15 AM`: `PRESENT`
- Check-in after `10:15 AM`: `LATE`
- `LATE` is included in the present-day total.
- ADMIN accounts are exempt from check-in and checkout.
- Workdays and holidays are configurable through environment variables.
- Holidays and non-working days are excluded from scheduled totals.
- The current unfinished day is not counted as missed.
- A user is not attendance-eligible before approval.
- Checkout requires a same-day check-in and duplicate checkout is rejected.

Monthly summaries are calculated from eligible scheduled working days. Present is the sum of on-time and late days; missed is an eligible scheduled day that has ended without a check-in. No historical absence rows are fabricated.

Employee endpoints return today’s status, personal history, and summary. MANAGER access is team-scoped. ADMIN access provides office-wide overview and monthly reporting.

## API endpoints

All endpoints below are relative to the API origin. Protected endpoints require the access token; refresh uses the HTTP-only refresh cookie.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health/database` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Admin registration | `GET /admin/registrations`, `PATCH /admin/registrations/:id/approve`, `PATCH /admin/registrations/:id/reject` |
| Attendance | `GET /attendance/today`, `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance/me`, `GET /attendance/me/summary`, `GET /attendance/team`, `GET /attendance/overview` |
| Tasks | `POST /tasks`, `GET /tasks`, `GET /tasks/my`, `GET /tasks/summary`, `GET /tasks/:id`, `GET /tasks/:id/activities`, `PATCH /tasks/:id`, `PATCH /tasks/:id/assign`, `PATCH /tasks/:id/status` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Users | `GET /users/assignable`, `GET /users/teams` |

## Database migration, backup, and recovery

Migration files are append-only and live under `apps/api/drizzle`. Before applying a pending migration to a non-isolated database:

```bash
pg_dump --format=custom --file=/secure/backup/path/office_management-YYYYMMDD-HHMM.dump "$DATABASE_URL"
pg_restore --list /secure/backup/path/office_management-YYYYMMDD-HHMM.dump
```

Verify the dump is non-empty, readable, outside Git-tracked directories, and protected with mode `600`. Restore into a new, uniquely named empty database first:

```bash
createdb office_management_restore_check
pg_restore --no-owner --dbname=office_management_restore_check /secure/backup/path/office_management-YYYYMMDD-HHMM.dump
```

Check core tables and counts, then remove only that temporary restore database after verification. To recover, stop application writers, create a replacement database, restore the verified custom-format dump with `pg_restore --no-owner`, verify counts and permissions, and switch the application connection only after approval. Do not reset, truncate, or reseed the live database as a recovery shortcut.

Apply the application migration only after backup and restore verification:

```bash
cd apps/api
npx drizzle-kit migrate --config=drizzle.config.ts
```

The isolated E2E database is `office_management_e2e`; mutation tests must never target `office_management`.

## Testing

API:

```bash
cd apps/api
npm run lint
npm run build
npm test -- --no-file-parallelism
E2E_ISOLATED_DATABASE=true npm run test:e2e -- --no-file-parallelism
```

Web unit/build checks:

```bash
cd apps/web
npm run lint
npm run build
npm test
```

Browser mutation tests require the isolated database, isolated API/web ports, and ignored E2E passwords. See [apps/web/DEMO.md](apps/web/DEMO.md) for the guarded command and cleanup procedure.

## Known limitations

- Leave Requests, Calendar, Complaints, Announcements, and Settings business workflows are placeholders.
- NestJS Observe remains installed with placeholder credentials. It is intentionally not connected and sends no telemetry until real credentials are configured.
- Real normal-database registration, approval, check-in/out, and task mutation acceptance must be performed and confirmed by the project owner.
- Attendance boundary behavior is covered deterministically by unit and isolated E2E tests; manual verification depends on the configured server time and workday.

## Release handoff

Before release, review `git diff`, confirm the intended files only, rerun the complete test suite, and inspect the remote branch:

```bash
git status --short --untracked-files=all
git diff --check
git diff --stat
git ls-remote origin refs/heads/main
```

Do not commit, tag, or push until the final file list and test results have been approved. The suggested release commit is:

```bash
git add README.md apps/web/DEMO.md \
  apps/web/e2e/attendance.spec.ts \
  apps/web/src/components/ui/badge.tsx \
  apps/web/src/components/ui/badge-variants.ts \
  apps/web/src/components/ui/button.tsx \
  apps/web/src/components/ui/button-variants.ts \
  apps/web/src/features/attendance/attendance-page.test.tsx \
  apps/web/src/features/auth/components/register-form.tsx \
  apps/web/src/layouts/app-layout.tsx \
  apps/web/src/pages/admin-registrations-page.tsx \
  apps/web/src/pages/attendance-page.tsx \
  apps/web/src/pages/not-found-page.tsx
git commit -m "chore: finalize office management attendance and registration release"
git push origin main
```

The commands above are instructions for an authorized maintainer, not an automatic release action.
