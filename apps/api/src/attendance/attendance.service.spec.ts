import type { ConfigService } from '@nestjs/config';
import type { DatabaseService } from '../database/database.service.js';
import type { Attendance } from '../database/schema.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { AttendanceService } from './attendance.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function currentUser(): AuthenticatedUser {
  return {
    id: USER_ID,
    fullName: 'Employee',
    email: 'employee@office.local',
    role: 'EMPLOYEE',
    teamId: null,
    isActive: true,
    approvalStatus: 'APPROVED',
  };
}

function makeRow(checkInAt: Date, checkInStatus: Attendance['checkInStatus']): Attendance {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    userId: USER_ID,
    attendanceDate: '2026-10-11',
    checkInAt,
    checkOutAt: null,
    checkInStatus,
    createdAt: checkInAt,
    updatedAt: checkInAt,
  };
}

function makeService(row: Attendance) {
  const profileLimit = vi.fn().mockResolvedValue([{ attendanceEligibleFrom: new Date('2026-10-01T00:00:00.000Z') }]);
  const rowLimit = vi.fn().mockResolvedValue([row]);
  const profileWhere = vi.fn().mockReturnValue({ limit: profileLimit });
  const rowWhere = vi.fn().mockReturnValue({ limit: rowLimit });
  const profileFrom = vi.fn().mockReturnValue({ where: profileWhere });
  const rowFrom = vi.fn().mockReturnValue({ where: rowWhere });
  const select = vi.fn()
    .mockReturnValueOnce({ from: profileFrom })
    .mockReturnValueOnce({ from: rowFrom });
  const conflict = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoNothing: conflict });
  const insert = vi.fn().mockReturnValue({ values });
  const service = new AttendanceService(
    { db: { select, insert } } as unknown as DatabaseService,
    { get: vi.fn(() => undefined) } as unknown as ConfigService,
  );
  return { service, conflict };
}

describe('AttendanceService', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ['at the office start', '2026-10-11T04:00:00.000Z'],
    ['at the exact grace boundary', '2026-10-11T04:15:00.000Z'],
  ])('classifies check-in %s as present', async (_label, timestamp) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(timestamp));
    const { service } = makeService(makeRow(new Date(timestamp), 'PRESENT'));

    const result = await service.checkIn(currentUser());

    expect(result.checkInStatus).toBe('PRESENT');
  });

  it('classifies check-in one second after grace as late', async () => {
    vi.useFakeTimers();
    const timestamp = new Date('2026-10-11T04:15:01.000Z');
    vi.setSystemTime(timestamp);
    const { service } = makeService(makeRow(timestamp, 'LATE'));

    const result = await service.checkIn(currentUser());

    expect(result.checkInStatus).toBe('LATE');
  });

  it('keeps a repeated check-in idempotent through the unique user-day key', async () => {
    vi.useFakeTimers();
    const firstCheckIn = new Date('2026-10-11T04:00:00.000Z');
    vi.setSystemTime(new Date('2026-10-11T06:00:00.000Z'));
    const { service, conflict } = makeService(makeRow(firstCheckIn, 'PRESENT'));

    const result = await service.checkIn(currentUser());

    expect(result.checkInAt).toEqual(firstCheckIn);
    expect(conflict).toHaveBeenCalledWith({ target: expect.any(Array) });
  });
});
