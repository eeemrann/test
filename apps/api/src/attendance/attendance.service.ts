import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { attendance, users, type Attendance } from '../database/schema.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import type { AttendanceQueryDto } from './dto/attendance-query.dto.js';

type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'MISSED'
  | 'NOT_CHECKED_IN'
  | 'CHECKED_OUT'
  | 'NON_WORKING_DAY'
  | 'FUTURE'
  | 'NOT_TRACKED'
  | 'EXEMPT';

type LocalParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
};

const DEFAULT_TIMEZONE = 'Asia/Dhaka';
const DEFAULT_WORKDAYS = new Set([0, 1, 2, 3, 4]);
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 31;

@Injectable()
export class AttendanceService {
  private readonly timezone: string;
  private readonly workdays: ReadonlySet<number>;
  private readonly holidays: ReadonlySet<string>;
  private readonly startSeconds: number;
  private readonly graceEndSeconds: number;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.timezone =
      this.configService.get<string>('OFFICE_TIMEZONE') ?? DEFAULT_TIMEZONE;
    this.workdays = this.parseWorkdays(
      this.configService.get<string>('OFFICE_WORKDAYS'),
    );
    this.holidays = new Set(
      (this.configService.get<string>('OFFICE_HOLIDAYS') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
    );
    this.startSeconds = this.parseClock(
      this.configService.get<string>('OFFICE_START_TIME') ?? '10:00',
    );
    this.graceEndSeconds = this.parseClock(
      this.configService.get<string>('OFFICE_GRACE_END_TIME') ?? '10:15',
    );

    if (this.graceEndSeconds < this.startSeconds) {
      throw new Error('OFFICE_GRACE_END_TIME must not be before OFFICE_START_TIME');
    }
  }

  async getToday(currentUser: AuthenticatedUser) {
    const now = new Date();
    const date = this.localDate(now);
    const profile = await this.getProfile(currentUser.id);

    if (currentUser.role === 'ADMIN') {
      return this.todayResponse(date, now, null, 'EXEMPT');
    }

    const eligible = this.isEligibleOnDate(profile.attendanceEligibleFrom, date);
    if (!eligible) {
      return this.todayResponse(date, now, null, 'NOT_TRACKED');
    }

    if (!this.isWorkingDate(date)) {
      return this.todayResponse(date, now, null, 'NON_WORKING_DAY');
    }

    const row = await this.findAttendance(currentUser.id, date);
    return this.todayResponse(
      date,
      now,
      row,
      row ? (row.checkOutAt ? 'CHECKED_OUT' : row.checkInStatus) : 'NOT_CHECKED_IN',
    );
  }

  async checkIn(currentUser: AuthenticatedUser) {
    this.assertCanAttend(currentUser);
    const now = new Date();
    const date = this.localDate(now);
    const profile = await this.getProfile(currentUser.id);
    this.assertEligibleWorkingDate(profile.attendanceEligibleFrom, date);

    const checkInStatus =
      this.clockSeconds(now) <= this.graceEndSeconds ? 'PRESENT' : 'LATE';

    try {
      await this.databaseService.db
        .insert(attendance)
        .values({
          userId: currentUser.id,
          attendanceDate: date,
          checkInAt: now,
          checkInStatus,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [attendance.userId, attendance.attendanceDate],
        });
    } catch {
      throw new InternalServerErrorException('Attendance operation failed');
    }

    const row = await this.findAttendance(currentUser.id, date);
    if (!row) {
      throw new ConflictException('Attendance check-in changed concurrently');
    }

    return this.attendanceResponse(row, false);
  }

  async checkOut(currentUser: AuthenticatedUser) {
    this.assertCanAttend(currentUser);
    const now = new Date();
    const date = this.localDate(now);

    try {
      const result = await this.databaseService.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(attendance)
          .where(
            and(
              eq(attendance.userId, currentUser.id),
              eq(attendance.attendanceDate, date),
            ),
          )
          .for('update');

        if (!row) {
          throw new ConflictException('Check in before checking out');
        }

        if (row.checkOutAt) {
          return { row, alreadyCheckedOut: true };
        }

        const [updated] = await tx
          .update(attendance)
          .set({ checkOutAt: now, updatedAt: now })
          .where(eq(attendance.id, row.id))
          .returning();

        if (!updated) {
          throw new ConflictException('Attendance changed concurrently');
        }

        return { row: updated, alreadyCheckedOut: false };
      });

      return this.attendanceResponse(result.row, result.alreadyCheckedOut);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Attendance operation failed');
    }
  }

  async getMine(currentUser: AuthenticatedUser, query: AttendanceQueryDto) {
    this.assertCanAttend(currentUser);
    const profile = await this.getProfile(currentUser.id);
    const range = this.resolveRange(query);
    const rows = await this.findAttendanceInRange(currentUser.id, range.from, range.to);
    const history = this.buildHistory(
      currentUser.id,
      profile.attendanceEligibleFrom,
      range.from,
      range.to,
      rows,
    );
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const summary = this.buildSummary(
      profile.attendanceEligibleFrom,
      range.from,
      range.to,
      rows,
    );

    return {
      data: history.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: history.length,
        totalPages: history.length === 0 ? 0 : Math.ceil(history.length / limit),
      },
      summary,
      timezone: this.timezone,
      officeHours: { start: '10:00', gracePeriodEnds: '10:15' },
    };
  }

  async getSummary(currentUser: AuthenticatedUser, query: AttendanceQueryDto) {
    this.assertCanAttend(currentUser);
    const profile = await this.getProfile(currentUser.id);
    const range = this.resolveRange(query);
    const rows = await this.findAttendanceInRange(currentUser.id, range.from, range.to);
    return {
      ...this.buildSummary(profile.attendanceEligibleFrom, range.from, range.to, rows),
      timezone: this.timezone,
    };
  }

  async getTeam(currentUser: AuthenticatedUser, query: AttendanceQueryDto) {
    if (currentUser.role !== 'MANAGER' && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('Team attendance is not permitted');
    }

    const range = this.resolveRange(query);
    const filters = [
      eq(users.isActive, true),
      eq(users.approvalStatus, 'APPROVED'),
      inArray(users.role, ['EMPLOYEE', 'MANAGER'] as const),
    ];
    if (currentUser.role === 'MANAGER') {
      if (!currentUser.teamId) return { data: [], pagination: this.pagination(1, query.limit ?? 20, 0), timezone: this.timezone };
      filters.push(eq(users.teamId, currentUser.teamId));
    } else if (query.teamId) {
      filters.push(eq(users.teamId, query.teamId));
    }
    if (query.employeeId) filters.push(eq(users.id, query.employeeId));

    try {
      const members = await this.databaseService.db
        .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, teamId: users.teamId, attendanceEligibleFrom: users.attendanceEligibleFrom })
        .from(users)
        .where(and(...filters))
        .orderBy(asc(users.fullName), asc(users.id));
      const memberIds = members.map((member) => member.id);
      const rows = memberIds.length
        ? await this.findAttendanceInRange(memberIds, range.from, range.to)
        : [];
      const data = rows.map((row) => ({
        ...this.attendanceResponse(row, false),
        user: members.find((member) => member.id === row.userId),
      }));
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      return { data: data.slice((page - 1) * limit, page * limit), pagination: this.pagination(page, limit, data.length), timezone: this.timezone };
    } catch {
      throw new InternalServerErrorException('Attendance operation failed');
    }
  }

  async getOverview(currentUser: AuthenticatedUser, query: AttendanceQueryDto) {
    if (currentUser.role !== 'MANAGER' && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('Attendance overview is not permitted');
    }

    const range = this.resolveRange(query);
    const memberFilters = [
      eq(users.isActive, true),
      eq(users.approvalStatus, 'APPROVED'),
      inArray(users.role, ['EMPLOYEE', 'MANAGER'] as const),
    ];
    if (currentUser.role === 'MANAGER') {
      if (!currentUser.teamId) return this.emptyOverview(range.from);
      memberFilters.push(eq(users.teamId, currentUser.teamId));
    } else if (query.teamId) {
      memberFilters.push(eq(users.teamId, query.teamId));
    }
    if (query.employeeId) memberFilters.push(eq(users.id, query.employeeId));

    const members = await this.databaseService.db
      .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, teamId: users.teamId, attendanceEligibleFrom: users.attendanceEligibleFrom })
      .from(users)
      .where(and(...memberFilters));
    const today = this.localDate(new Date());
    const rows = members.length ? await this.findAttendanceInRange(members.map((member) => member.id), range.from, range.to) : [];
    const todayRows = members.length
      ? await this.findAttendanceInRange(members.map((member) => member.id), today, today)
      : [];
    const isWorkingDay = this.isWorkingDate(today);
    const eligibleToday = members.filter((member) => this.isEligibleOnDate(member.attendanceEligibleFrom, today));
    const monthly = members.reduce(
      (acc, member) => {
        const memberRows = rows.filter((row) => row.userId === member.id);
        const summary = this.buildSummary(member.attendanceEligibleFrom, range.from, range.to, memberRows);
        acc.present += summary.totalPresentDays;
        acc.late += summary.totalLateDays;
        acc.missed += summary.totalMissedDays;
        acc.scheduled += summary.totalScheduledWorkingDays;
        return acc;
      },
      { present: 0, late: 0, missed: 0, scheduled: 0 },
    );

    return {
      timezone: this.timezone,
      date: today,
      isWorkingDay,
      totalApprovedActiveStaff: eligibleToday.length,
      checkedInStaff: todayRows.length,
      lateStaff: todayRows.filter((row) => row.checkInStatus === 'LATE').length,
      notYetCheckedIn: isWorkingDay ? Math.max(eligibleToday.length - todayRows.length, 0) : 0,
      monthlySummary: monthly,
      staff: members.map((member) => {
        const row = todayRows.find((item) => item.userId === member.id);
        return {
          id: member.id,
          fullName: member.fullName,
          email: member.email,
          role: member.role,
          teamId: member.teamId,
          status: row ? (row.checkOutAt ? 'CHECKED_OUT' : row.checkInStatus) : (isWorkingDay ? 'NOT_CHECKED_IN' : 'NON_WORKING_DAY'),
          checkInAt: row?.checkInAt ?? null,
          checkOutAt: row?.checkOutAt ?? null,
        };
      }),
    };
  }

  private async getProfile(id: string) {
    const [profile] = await this.databaseService.db
      .select({ attendanceEligibleFrom: users.attendanceEligibleFrom })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return profile ?? { attendanceEligibleFrom: null };
  }

  private async findAttendance(userId: string, date: string) {
    const [row] = await this.databaseService.db
      .select()
      .from(attendance)
      .where(and(eq(attendance.userId, userId), eq(attendance.attendanceDate, date)))
      .limit(1);
    return row;
  }

  private async findAttendanceInRange(userIds: string | string[], from: string, to: string) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    if (ids.length === 0) return [];
    return this.databaseService.db
      .select()
      .from(attendance)
      .where(and(inArray(attendance.userId, ids), gte(attendance.attendanceDate, from), lte(attendance.attendanceDate, to)))
      .orderBy(asc(attendance.attendanceDate), asc(attendance.userId));
  }

  private todayResponse(date: string, now: Date, row: Attendance | null, status: AttendanceStatus) {
    return {
      date,
      status,
      isWorkingDay: this.isWorkingDate(date),
      timezone: this.timezone,
      officeHours: { start: '10:00', gracePeriodEnds: '10:15' },
      checkInAt: row?.checkInAt ?? null,
      checkOutAt: row?.checkOutAt ?? null,
      checkInStatus: row?.checkInStatus ?? null,
      serverTime: now,
    };
  }

  private attendanceResponse(row: Attendance, alreadyCompleted: boolean) {
    return {
      id: row.id,
      date: row.attendanceDate,
      status: row.checkOutAt ? 'CHECKED_OUT' : row.checkInStatus,
      checkInStatus: row.checkInStatus,
      checkInAt: row.checkInAt,
      checkOutAt: row.checkOutAt,
      alreadyCompleted,
      isWorkingDay: true,
      timezone: this.timezone,
      officeHours: { start: '10:00', gracePeriodEnds: '10:15' },
      serverTime: new Date(),
    };
  }

  private buildHistory(
    userId: string,
    eligibleFrom: Date | null,
    from: string,
    to: string,
    rows: Attendance[],
  ) {
    const rowMap = new Map(rows.filter((row) => row.userId === userId).map((row) => [row.attendanceDate, row]));
    const today = this.localDate(new Date());
    return this.dateRange(from, to).map((date) => {
      const row = rowMap.get(date);
      let status: AttendanceStatus;
      if (!this.isEligibleOnDate(eligibleFrom, date)) status = 'NOT_TRACKED';
      else if (!this.isWorkingDate(date)) status = 'NON_WORKING_DAY';
      else if (date > today) status = 'FUTURE';
      else if (row) status = row.checkInStatus;
      else if (date === today) status = 'NOT_CHECKED_IN';
      else status = 'MISSED';
      return {
        date,
        day: this.dayName(date),
        status,
        checkInAt: row?.checkInAt ?? null,
        checkOutAt: row?.checkOutAt ?? null,
        checkInStatus: row?.checkInStatus ?? null,
      };
    });
  }

  private buildSummary(eligibleFrom: Date | null, from: string, to: string, rows: Attendance[]) {
    const today = this.localDate(new Date());
    const completedScheduledDates = this.dateRange(from, to).filter(
      (date) => date < today && this.isWorkingDate(date) && this.isEligibleOnDate(eligibleFrom, date),
    );
    const validRows = new Map(rows.map((row) => [row.attendanceDate, row]));
    const present = completedScheduledDates.filter((date) => validRows.has(date)).length;
    const late = completedScheduledDates.filter((date) => validRows.get(date)?.checkInStatus === 'LATE').length;
    const scheduled = completedScheduledDates.length;
    const missed = scheduled - present;
    return {
      totalPresentDays: present,
      totalLateDays: late,
      totalMissedDays: missed,
      totalScheduledWorkingDays: scheduled,
      onTimeDays: present - late,
      attendancePercentage: scheduled === 0 ? 0 : Math.round((present / scheduled) * 10000) / 100,
    };
  }

  private resolveRange(query: AttendanceQueryDto) {
    if (query.dateFrom || query.dateTo) {
      const from = query.dateFrom ?? query.dateTo!;
      const to = query.dateTo ?? query.dateFrom!;
      if (from > to) throw new BadRequestException('dateFrom must not be after dateTo');
      return { from, to };
    }
    const month = query.month ?? this.localDate(new Date()).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month must use YYYY-MM format');
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
  }

  private assertCanAttend(user: AuthenticatedUser) {
    if (!user.isActive || user.approvalStatus !== 'APPROVED' || !['EMPLOYEE', 'MANAGER'].includes(user.role)) {
      throw new ForbiddenException('This account is not eligible for attendance');
    }
  }

  private assertEligibleWorkingDate(eligibleFrom: Date | null, date: string) {
    if (!this.isEligibleOnDate(eligibleFrom, date)) throw new ForbiddenException('Attendance has not started for this account');
    if (!this.isWorkingDate(date)) throw new BadRequestException('Today is not a scheduled working day');
  }

  private isEligibleOnDate(eligibleFrom: Date | null, date: string) {
    return !eligibleFrom || this.localDate(eligibleFrom) <= date;
  }

  private isWorkingDate(date: string) {
    return this.workdays.has(this.utcDay(date)) && !this.holidays.has(date);
  }

  private localDate(date: Date) {
    const parts = this.localParts(date);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  private localParts(date: Date): LocalParts {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      weekday: weekdays.indexOf(values.weekday),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
    };
  }

  private clockSeconds(date: Date) {
    const parts = this.localParts(date);
    return parts.hour * 3600 + parts.minute * 60 + parts.second;
  }

  private parseClock(value: string) {
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match) throw new Error('Office clock configuration must use HH:MM[:SS]');
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] ?? 0);
    if (hours > 23 || minutes > 59 || seconds > 59) throw new Error('Invalid office clock configuration');
    return hours * 3600 + minutes * 60 + seconds;
  }

  private parseWorkdays(value: string | undefined) {
    if (!value) return DEFAULT_WORKDAYS;
    const days = new Set(value.split(',').map((part) => Number(part.trim())).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
    return days.size ? days : DEFAULT_WORKDAYS;
  }

  private utcDay(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  private dateRange(from: string, to: string) {
    const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
    const [toYear, toMonth, toDay] = to.split('-').map(Number);
    const result: string[] = [];
    for (let date = new Date(Date.UTC(fromYear, fromMonth - 1, fromDay)); date <= new Date(Date.UTC(toYear, toMonth - 1, toDay)); date.setUTCDate(date.getUTCDate() + 1)) {
      result.push(date.toISOString().slice(0, 10));
    }
    return result;
  }

  private dayName(date: string) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  }

  private pagination(page: number, limit: number, total: number) {
    return { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
  }

  private emptyOverview(date: string) {
    return { timezone: this.timezone, date, isWorkingDay: this.isWorkingDate(date), totalApprovedActiveStaff: 0, checkedInStaff: 0, lateStaff: 0, notYetCheckedIn: 0, monthlySummary: { present: 0, late: 0, missed: 0, scheduled: 0 }, staff: [] };
  }
}
