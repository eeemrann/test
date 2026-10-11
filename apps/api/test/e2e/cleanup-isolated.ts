import { inArray, like, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  assertIsolatedDatabaseUrl,
  E2E_TASK_PREFIX,
  getIsolatedDatabaseUrl,
  isolatedAccounts,
  loadLocalEnvironment,
} from './isolated-db.js';
import {
  attendance,
  notifications,
  refreshSessions,
  taskActivities,
  tasks,
  users,
} from '../../src/database/schema.js';

loadLocalEnvironment();
const databaseUrl = getIsolatedDatabaseUrl();
assertIsolatedDatabaseUrl(databaseUrl);
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);
const acceptanceTitlePrefixes = [
  E2E_TASK_PREFIX,
  'Browser workflow ',
  'Realtime browser workflow ',
];
const acceptanceTaskFilter = or(
  ...acceptanceTitlePrefixes.map((prefix) => like(tasks.title, `${prefix}%`)),
);

try {
  const fixtures = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(acceptanceTaskFilter);
  const ids = fixtures.map((task) => task.id);

  if (ids.length > 0) {
    await db.delete(notifications).where(inArray(notifications.taskId, ids));
    await db.delete(taskActivities).where(inArray(taskActivities.taskId, ids));
    await db.delete(tasks).where(inArray(tasks.id, ids));
  }

  const notificationsOnly = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(like(notifications.title, `${E2E_TASK_PREFIX}%`));
  if (notificationsOnly.length > 0) {
    await db.delete(notifications).where(
      inArray(notifications.id, notificationsOnly.map((notification) => notification.id)),
    );
  }

  const fixtureUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, isolatedAccounts.map((account) => account.email)));
  if (fixtureUsers.length > 0) {
    await db.delete(attendance).where(
      inArray(attendance.userId, fixtureUsers.map((user) => user.id)),
    );
    await db.delete(refreshSessions).where(
      inArray(refreshSessions.userId, fixtureUsers.map((user) => user.id)),
    );
  }

  const browserUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, 'browser-%@office.local'));
  if (browserUsers.length > 0) {
    const browserUserIds = browserUsers.map((user) => user.id);
    await db.delete(attendance).where(inArray(attendance.userId, browserUserIds));
    await db.delete(refreshSessions).where(inArray(refreshSessions.userId, browserUserIds));
    await db.delete(users).where(inArray(users.id, browserUserIds));
  }

  console.log(`isolated cleanup removed ${ids.length} acceptance task(s), ${browserUsers.length} browser registration(s), fixture attendance, and fixture sessions`);
} finally {
  await pool.end();
}
