import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ISOLATED_DATABASE_NAME = 'office_management_e2e';
export const ISOLATED_DATABASE_HOST = '127.0.0.1';
export const ISOLATED_DATABASE_PORT = '55432';
export const ISOLATED_FRONTEND_URL = 'http://127.0.0.1:5175';
export const ISOLATED_API_PORT = '3002';
export const E2E_TASK_PREFIX = 'e2e-acceptance-';

const apiDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export const isolatedAccounts = [
  {
    fullName: 'System Admin',
    email: 'e2e.admin@office.local',
    role: 'ADMIN' as const,
    teamName: null,
    passwordVariable: 'E2E_ADMIN_PASSWORD',
  },
  {
    fullName: 'Engineering Manager',
    email: 'e2e.eng.manager@office.local',
    role: 'MANAGER' as const,
    teamName: 'Engineering',
    passwordVariable: 'E2E_MANAGER_PASSWORD',
  },
  {
    fullName: 'Engineering Employee One',
    email: 'e2e.eng.employee.one@office.local',
    role: 'EMPLOYEE' as const,
    teamName: 'Engineering',
    passwordVariable: 'E2E_EMPLOYEE_PASSWORD',
  },
  {
    fullName: 'Engineering Employee Two',
    email: 'e2e.eng.employee.two@office.local',
    role: 'EMPLOYEE' as const,
    teamName: 'Engineering',
    passwordVariable: 'E2E_EMPLOYEE_PASSWORD',
  },
  {
    fullName: 'Operations Manager',
    email: 'e2e.ops.manager@office.local',
    role: 'MANAGER' as const,
    teamName: 'Operations',
    passwordVariable: 'E2E_MANAGER_PASSWORD',
  },
  {
    fullName: 'Operations Employee One',
    email: 'e2e.ops.employee.one@office.local',
    role: 'EMPLOYEE' as const,
    teamName: 'Operations',
    passwordVariable: 'E2E_EMPLOYEE_PASSWORD',
  },
  {
    fullName: 'Operations Employee Two',
    email: 'e2e.ops.employee.two@office.local',
    role: 'EMPLOYEE' as const,
    teamName: 'Operations',
    passwordVariable: 'E2E_EMPLOYEE_PASSWORD',
  },
] as const;

export function loadLocalEnvironment(): void {
  loadEnv({ path: resolve(apiDirectory, '.env.e2e') });
  loadEnv({ path: resolve(apiDirectory, '.env') });
}

function parseDatabaseUrl(value: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Isolated E2E safety guard refused: ${label} is invalid.`);
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(
      `Isolated E2E safety guard refused: ${label} must use PostgreSQL.`,
    );
  }

  return parsed;
}

export function assertNormalDatabaseUrl(value: string): URL {
  const parsed = parseDatabaseUrl(value, 'DATABASE_URL');
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (
    parsed.hostname !== ISOLATED_DATABASE_HOST ||
    parsed.port !== ISOLATED_DATABASE_PORT ||
    databaseName !== 'office_management'
  ) {
    throw new Error(
      'Isolated E2E safety guard refused: the normal source must be 127.0.0.1:55432/office_management.',
    );
  }

  return parsed;
}

export function assertIsolatedDatabaseUrl(value: string): URL {
  const parsed = parseDatabaseUrl(value, 'E2E_DATABASE_URL');
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (
    parsed.hostname !== ISOLATED_DATABASE_HOST ||
    parsed.port !== ISOLATED_DATABASE_PORT ||
    databaseName !== ISOLATED_DATABASE_NAME
  ) {
    throw new Error(
      'Isolated E2E safety guard refused: the target must be 127.0.0.1:55432/office_management_e2e.',
    );
  }

  return parsed;
}

export function getIsolatedDatabaseUrl(): string {
  const configured = process.env.E2E_DATABASE_URL;
  if (configured) {
    assertIsolatedDatabaseUrl(configured);
    return configured;
  }

  const normalUrl = process.env.DATABASE_URL;
  if (!normalUrl) {
    throw new Error('DATABASE_URL is missing for isolated E2E setup.');
  }

  const parsed = assertNormalDatabaseUrl(normalUrl);
  parsed.pathname = `/${ISOLATED_DATABASE_NAME}`;
  const isolatedUrl = parsed.toString();
  assertIsolatedDatabaseUrl(isolatedUrl);
  return isolatedUrl;
}

export function getMaintenanceDatabaseUrl(): string {
  const parsed = assertNormalDatabaseUrl(process.env.DATABASE_URL ?? '');
  parsed.pathname = '/postgres';
  return parsed.toString();
}

export function getFixturePassword(variable: string): string {
  const value = process.env[variable];
  if (!value || value.length < 16) {
    throw new Error(`${variable} must be configured with at least 16 characters.`);
  }

  return value;
}
