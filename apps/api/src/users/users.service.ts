import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { users } from '../database/schema.js';
import type { AssignableUserQueryDto } from './dto/assignable-user-query.dto.js';
import type {
  AssignableUserResponse,
  PaginatedResponse,
} from '../tasks/types/task.types.js';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listAssignable(
    query: AssignableUserQueryDto,
  ): Promise<PaginatedResponse<AssignableUserResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = [eq(users.role, 'EMPLOYEE'), eq(users.isActive, true)];

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
}
