import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { teams, users } from './schema.js';

const seedDirectory = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(seedDirectory, '../../.env') });

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 16;

type SeedRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

type SeedUser = {
  fullName: string;
  email: string;
  role: SeedRole;
  teamName: string | null;
  passwordVariable: string;
};

class SeedSafetyError extends Error {}

class SeedConflictError extends Error {}

const seedTeams = [
  {
    name: 'Engineering',
    description: 'Engineering and product development',
  },
  {
    name: 'Operations',
    description: 'Business operations and support',
  },
] as const;

const seedUsers: readonly SeedUser[] = [
  {
    fullName: 'System Admin',
    email: 'admin@office.local',
    role: 'ADMIN',
    teamName: null,
    passwordVariable: 'SEED_ADMIN_PASSWORD',
  },
  {
    fullName: 'Engineering Manager',
    email: 'eng.manager@office.local',
    role: 'MANAGER',
    teamName: 'Engineering',
    passwordVariable: 'SEED_MANAGER_PASSWORD',
  },
  {
    fullName: 'Engineering Employee',
    email: 'eng.employee@office.local',
    role: 'EMPLOYEE',
    teamName: 'Engineering',
    passwordVariable: 'SEED_EMPLOYEE_PASSWORD',
  },
  {
    fullName: 'Operations Manager',
    email: 'ops.manager@office.local',
    role: 'MANAGER',
    teamName: 'Operations',
    passwordVariable: 'SEED_MANAGER_PASSWORD',
  },
  {
    fullName: 'Operations Employee',
    email: 'ops.employee@office.local',
    role: 'EMPLOYEE',
    teamName: 'Operations',
    passwordVariable: 'SEED_EMPLOYEE_PASSWORD',
  },
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireEnvironment(): {
  databaseUrl: string;
  passwords: Record<string, string>;
} {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    throw new SeedSafetyError(
      'Seed refused: SEED_DEMO_DATA must be exactly true.',
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new SeedSafetyError('Seed refused: production mode is not allowed.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new SeedSafetyError('Seed refused: DATABASE_URL is missing.');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new SeedSafetyError('Seed refused: DATABASE_URL is invalid.');
  }

  const databaseName = decodeURIComponent(
    parsedDatabaseUrl.pathname.replace(/^\//, ''),
  );
  const isLocalDevelopmentDatabase =
    (parsedDatabaseUrl.protocol === 'postgresql:' ||
      parsedDatabaseUrl.protocol === 'postgres:') &&
    parsedDatabaseUrl.hostname === '127.0.0.1' &&
    parsedDatabaseUrl.port === '55432' &&
    databaseName === 'office_management';

  if (!isLocalDevelopmentDatabase) {
    throw new SeedSafetyError(
      'Seed refused: DATABASE_URL must target the local development database.',
    );
  }

  const passwords: Record<string, string> = {};
  for (const variable of [
    'SEED_ADMIN_PASSWORD',
    'SEED_MANAGER_PASSWORD',
    'SEED_EMPLOYEE_PASSWORD',
  ]) {
    const password = process.env[variable];

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new SeedSafetyError(
        `Seed refused: ${variable} must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    const normalizedPassword = password.toLowerCase();
    if (
      ['password', 'replace_me', 'change_me', 'admin123', 'manager123'].some(
        (value) => normalizedPassword.includes(value),
      )
    ) {
      throw new SeedSafetyError(
        `Seed refused: ${variable} must not use a predictable placeholder password.`,
      );
    }

    passwords[variable] = password;
  }

  return { databaseUrl, passwords };
}

async function seedDatabase(): Promise<void> {
  const { databaseUrl, passwords } = requireEnvironment();
  let pool: Pool | undefined;
  let createdTeams = 0;
  let existingTeams = 0;
  let createdUsers = 0;
  let existingUsers = 0;

  try {
    pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);

    await db.execute(sql`SELECT 1`);

    await db.transaction(async (tx) => {
      const teamIds = new Map<string, string>();

      for (const teamSeed of seedTeams) {
        const existingTeam = await tx
          .select({ id: teams.id })
          .from(teams)
          .where(eq(teams.name, teamSeed.name))
          .limit(1);

        if (existingTeam[0]) {
          teamIds.set(teamSeed.name, existingTeam[0].id);
          existingTeams += 1;
          continue;
        }

        const insertedTeam = await tx
          .insert(teams)
          .values(teamSeed)
          .returning({ id: teams.id });

        teamIds.set(teamSeed.name, insertedTeam[0].id);
        createdTeams += 1;
      }

      for (const userSeed of seedUsers) {
        const email = normalizeEmail(userSeed.email);
        const teamId = userSeed.teamName
          ? teamIds.get(userSeed.teamName) ?? null
          : null;

        if (userSeed.teamName && !teamId) {
          throw new SeedSafetyError(
            `Seed refused: team ${userSeed.teamName} could not be resolved.`,
          );
        }

        const existingUser = await tx
          .select({
            id: users.id,
            fullName: users.fullName,
            role: users.role,
            teamId: users.teamId,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser[0]) {
          const existing = existingUser[0];
          const conflicts: string[] = [];

          if (existing.fullName !== userSeed.fullName) {
            conflicts.push('full name');
          }
          if (existing.role !== userSeed.role) {
            conflicts.push('role');
          }
          if (existing.teamId !== teamId) {
            conflicts.push('team');
          }
          if (!existing.isActive) {
            conflicts.push('active status');
          }

          if (conflicts.length > 0) {
            throw new SeedConflictError(
              `Seed conflict for ${email}: ${conflicts.join(', ')} differ from the demo definition. Existing data was not changed.`,
            );
          }

          existingUsers += 1;
          continue;
        }

        const password = passwords[userSeed.passwordVariable];
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await tx.insert(users).values({
          fullName: userSeed.fullName,
          email,
          passwordHash,
          role: userSeed.role,
          teamId,
          isActive: true,
        });

        createdUsers += 1;
      }
    });

    console.log(
      `Seed completed: teams created=${createdTeams}, existing=${existingTeams}; users created=${createdUsers}, existing=${existingUsers}.`,
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

try {
  await seedDatabase();
} catch (error) {
  if (error instanceof SeedSafetyError || error instanceof SeedConflictError) {
    console.error(error.message);
  } else {
    console.error('Seed failed due to an unexpected database error.');
  }

  process.exitCode = 1;
}
