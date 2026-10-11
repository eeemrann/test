import { spawnSync } from 'node:child_process';
import pg from 'pg';
import {
  getIsolatedDatabaseUrl,
  getMaintenanceDatabaseUrl,
  loadLocalEnvironment,
} from './isolated-db.js';
import { seedIsolatedFixtures } from './seed-isolated-fixtures.js';

export async function ensureIsolatedDatabase(): Promise<string> {
  const databaseUrl = getIsolatedDatabaseUrl();
  const maintenance = new pg.Client({ connectionString: getMaintenanceDatabaseUrl() });

  try {
    await maintenance.connect();
    const existing = await maintenance.query(
      "SELECT datname, datallowconn, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = 'office_management_e2e'",
    );

    if (existing.rowCount === 0) {
      await maintenance.query('CREATE DATABASE office_management_e2e WITH OWNER office_user');
    } else if (
      existing.rows[0].owner !== 'office_user' ||
      existing.rows[0].datallowconn !== true
    ) {
      throw new Error(
        'Isolated E2E safety guard refused: office_management_e2e has an unexpected owner or is not connectable.',
      );
    }
  } finally {
    await maintenance.end().catch(() => undefined);
  }

  const migration = spawnSync(
    'npx',
    ['--no-install', 'drizzle-kit', 'migrate', '--config=drizzle.e2e.config.ts'],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    },
  );
  if (migration.stdout) process.stdout.write(migration.stdout);
  if (migration.stderr) process.stderr.write(migration.stderr);
  if (migration.status !== 0) {
    throw new Error('Isolated E2E migration failed. No destructive recovery was attempted.');
  }

  await seedIsolatedFixtures(databaseUrl);
  return databaseUrl;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadLocalEnvironment();
  await ensureIsolatedDatabase();
}
