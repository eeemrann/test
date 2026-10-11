import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  getFixturePassword,
  getIsolatedDatabaseUrl,
  isolatedAccounts,
  loadLocalEnvironment,
} from './isolated-db.js';
import { teams, users } from '../../src/database/schema.js';

const BCRYPT_ROUNDS = 12;

export async function seedIsolatedFixtures(databaseUrl = getIsolatedDatabaseUrl()): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  let createdTeams = 0;
  let createdUsers = 0;

  try {
    await db.transaction(async (tx) => {
      const teamIds = new Map<string, string>();

      for (const team of [
        { name: 'Engineering', description: 'Engineering and product development' },
        { name: 'Operations', description: 'Business operations and support' },
      ]) {
        const existing = await tx
          .select({ id: teams.id })
          .from(teams)
          .where(eq(teams.name, team.name))
          .limit(1);

        if (existing[0]) {
          teamIds.set(team.name, existing[0].id);
          continue;
        }

        const [inserted] = await tx.insert(teams).values(team).returning({ id: teams.id });
        teamIds.set(team.name, inserted.id);
        createdTeams += 1;
      }

      for (const account of isolatedAccounts) {
        const teamId = account.teamName ? teamIds.get(account.teamName) ?? null : null;
        const existing = await tx
          .select({
            id: users.id,
            fullName: users.fullName,
            role: users.role,
            teamId: users.teamId,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.email, account.email))
          .limit(1);

        if (existing[0]) {
          const user = existing[0];
          if (
            user.fullName !== account.fullName ||
            user.role !== account.role ||
            user.teamId !== teamId ||
            !user.isActive
          ) {
            throw new Error(
              `Isolated fixture conflict for ${account.email}; existing data was not changed.`,
            );
          }
          continue;
        }

        await tx.insert(users).values({
          fullName: account.fullName,
          email: account.email,
          passwordHash: await bcrypt.hash(
            getFixturePassword(account.passwordVariable),
            BCRYPT_ROUNDS,
          ),
          role: account.role,
          teamId,
          isActive: true,
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          attendanceEligibleFrom: new Date(),
        });
        createdUsers += 1;
      }
    });
  } finally {
    await pool.end();
  }

  console.log(`isolated fixtures ready: ${createdTeams} teams, ${createdUsers} users created`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadLocalEnvironment();
  await seedIsolatedFixtures();
}
