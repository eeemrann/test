import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { registrationAudits, teams, users } from '../database/schema.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import type { ApproveRegistrationDto } from './dto/approve-registration.dto.js';
import type { RegistrationQueryDto } from './dto/registration-query.dto.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class AdminService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listRegistrations(query: RegistrationQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filters = [];

    if (query.status) {
      filters.push(eq(users.approvalStatus, query.status));
    }

    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      filters.push(or(ilike(users.fullName, pattern), ilike(users.email, pattern))!);
    }

    const where = filters.length ? and(...filters) : undefined;

    try {
      const [countRows, rows] = await Promise.all([
        this.databaseService.db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(where),
        this.databaseService.db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
            approvalStatus: users.approvalStatus,
            isActive: users.isActive,
            teamId: users.teamId,
            teamName: teams.name,
            createdAt: users.createdAt,
            approvedAt: users.approvedAt,
            rejectedAt: users.rejectedAt,
          })
          .from(users)
          .leftJoin(teams, eq(users.teamId, teams.id))
          .where(where)
          .orderBy(desc(users.createdAt), asc(users.id))
          .limit(limit)
          .offset((page - 1) * limit),
      ]);

      const total = Number(countRows[0]?.count ?? 0);
      return {
        data: rows.map((row) => ({
          ...row,
          team: row.teamId && row.teamName ? { id: row.teamId, name: row.teamName } : null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      };
    } catch {
      throw new InternalServerErrorException('Registration operation failed');
    }
  }

  async approveRegistration(
    id: string,
    dto: ApproveRegistrationDto,
    actor: AuthenticatedUser,
  ) {
    try {
      return await this.databaseService.db.transaction(async (tx) => {
        if (dto.teamId) {
          const [team] = await tx
            .select({ id: teams.id })
            .from(teams)
            .where(eq(teams.id, dto.teamId))
            .limit(1);

          if (!team) {
            throw new NotFoundException('Team not found');
          }
        }

        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, id))
          .for('update');

        if (!user) {
          throw new NotFoundException('Registration not found');
        }

        if (user.approvalStatus !== 'PENDING') {
          throw new ConflictException('Registration has already been decided');
        }

        const now = new Date();
        const [updated] = await tx
          .update(users)
          .set({
            approvalStatus: 'APPROVED',
            isActive: true,
            role: 'EMPLOYEE',
            teamId: dto.teamId ?? user.teamId,
            approvedAt: now,
            rejectedAt: null,
            attendanceEligibleFrom: now,
            updatedAt: now,
          })
          .where(eq(users.id, id))
          .returning({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
            approvalStatus: users.approvalStatus,
            teamId: users.teamId,
            isActive: users.isActive,
          });

        if (!updated) {
          throw new ConflictException('Registration changed concurrently');
        }

        await tx.insert(registrationAudits).values({
          userId: id,
          actorUserId: actor.id,
          action: 'APPROVED',
          createdAt: now,
        });

        return updated;
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Registration operation failed');
    }
  }

  async rejectRegistration(id: string, actor: AuthenticatedUser) {
    try {
      return await this.databaseService.db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, id))
          .for('update');

        if (!user) {
          throw new NotFoundException('Registration not found');
        }

        if (user.approvalStatus !== 'PENDING') {
          throw new ConflictException('Registration has already been decided');
        }

        const now = new Date();
        const [updated] = await tx
          .update(users)
          .set({
            approvalStatus: 'REJECTED',
            isActive: false,
            rejectedAt: now,
            updatedAt: now,
          })
          .where(eq(users.id, id))
          .returning({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
            approvalStatus: users.approvalStatus,
            teamId: users.teamId,
            isActive: users.isActive,
          });

        if (!updated) {
          throw new ConflictException('Registration changed concurrently');
        }

        await tx.insert(registrationAudits).values({
          userId: id,
          actorUserId: actor.id,
          action: 'REJECTED',
          createdAt: now,
        });

        return updated;
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Registration operation failed');
    }
  }
}
