import { inArray, like, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  assertIsolatedDatabaseUrl,
  E2E_TASK_PREFIX,
  getIsolatedDatabaseUrl,
  loadLocalEnvironment,
} from './isolated-db.js';
import { notifications, taskActivities, tasks } from '../../src/database/schema.js';

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

  console.log(`isolated cleanup removed ${ids.length} acceptance task(s)`);
} finally {
  await pool.end();
}
