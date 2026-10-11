import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { teams, users } from '../database/schema.js';
import type { AssignableUserQueryDto } from './dto/assignable-user-query.dto.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import type {
  AssignableUserResponse,
  PaginatedResponse,
} from '../tasks/types/task.types.js';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listAssignable(
    query: AssignableUserQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponse<AssignableUserResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = [
      eq(users.isActive, true),
      eq(users.approvalStatus, 'APPROVED'),
    ];

    if (!query.purpose) {
      filters.push(eq(users.role, 'EMPLOYEE'));
    } else if (currentUser.role === 'EMPLOYEE') {
      filters.push(eq(users.role, 'EMPLOYEE'));
    } else if (currentUser.role === 'MANAGER') {
      if (query.purpose === 'reassign') {
        filters.push(
          currentUser.teamId
            ? or(
                eq(users.role, 'ADMIN'),
                and(eq(users.role, 'EMPLOYEE'), eq(users.teamId, currentUser.teamId)),
              )!
            : eq(users.role, 'ADMIN'),
        );
      } else {
        filters.push(or(eq(users.role, 'EMPLOYEE'), eq(users.role, 'ADMIN'))!);
      }
    }

    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      filters.push(
        or(ilike(users.fullName, pattern), ilike(users.email, pattern))!,
      );
    }

    const where = and(...filters);

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
            teamId: users.teamId,
            ...(query.purpose ? { role: users.role } : {}),
          })
          .from(users)
          .where(where)
          .orderBy(asc(users.fullName), asc(users.id))
          .limit(limit)
          .offset((page - 1) * limit),
      ]);

      const total = Number(countRows[0]?.count ?? 0);
      return {
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      };
    } catch {
      throw new InternalServerErrorException('User operation failed');
    }
  }

  async listTeams() {
    try {
      return this.databaseService.db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .orderBy(asc(teams.name), asc(teams.id));
    } catch {
      throw new InternalServerErrorException('User operation failed');
    }
  }
}
