import { ensureIsolatedDatabase } from './setup-isolated-db.js';
import {
  getIsolatedDatabaseUrl,
  ISOLATED_API_PORT,
  ISOLATED_FRONTEND_URL,
  loadLocalEnvironment,
} from './isolated-db.js';

loadLocalEnvironment();
const databaseUrl = await ensureIsolatedDatabase();

process.env.DATABASE_URL = databaseUrl;
process.env.E2E_DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.E2E_API_PORT ?? ISOLATED_API_PORT;
process.env.FRONTEND_URL =
  process.env.E2E_FRONTEND_URL ?? `${ISOLATED_FRONTEND_URL},http://localhost:5175`;

if (getIsolatedDatabaseUrl() !== databaseUrl) {
  throw new Error('Isolated E2E safety guard refused: backend URL changed unexpectedly.');
}

await import('../../dist/main.js');
