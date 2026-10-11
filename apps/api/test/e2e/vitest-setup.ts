import { ensureIsolatedDatabase } from './setup-isolated-db.js';
import { loadLocalEnvironment } from './isolated-db.js';

loadLocalEnvironment();
process.env.E2E_ISOLATED_DATABASE = 'true';

const isolatedDatabaseUrl = await ensureIsolatedDatabase();
process.env.DATABASE_URL = isolatedDatabaseUrl;
process.env.E2E_DATABASE_URL = isolatedDatabaseUrl;
process.env.NODE_ENV = 'test';
