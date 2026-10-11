import type { DatabaseService } from '../database/database.service.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { AdminService } from './admin.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

function actor(): AuthenticatedUser {
  return {
    id: ACTOR_ID,
    fullName: 'System Admin',
    email: 'admin@office.local',
    role: 'ADMIN',
    teamId: null,
    isActive: true,
    approvalStatus: 'APPROVED',
  };
}

function pendingUser() {
  return {
    id: USER_ID,
    fullName: 'Pending Employee',
    email: 'pending@office.local',
    role: 'EMPLOYEE' as const,
    approvalStatus: 'PENDING' as const,
    isActive: false,
    teamId: null,
  };
}

function makeService(updated: Record<string, unknown>) {
  const current = pendingUser();
  const forUpdate = vi.fn().mockResolvedValue([current]);
  const where = vi.fn().mockReturnValue({ for: forUpdate });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const updateReturning = vi.fn().mockResolvedValue([updated]);
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });
  const auditValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: auditValues });
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ select, update, insert }),
  );
  const service = new AdminService({ db: { transaction } } as unknown as DatabaseService);

  return { service, updateSet, auditValues };
}

describe('AdminService registration decisions', () => {
  it('approves a pending registration as an active employee and records the actor', async () => {
    const updated = {
      ...pendingUser(),
      role: 'EMPLOYEE' as const,
      approvalStatus: 'APPROVED' as const,
      isActive: true,
    };
    const { service, updateSet, auditValues } = makeService(updated);

    const result = await service.approveRegistration(USER_ID, {}, actor());

    expect(result).toEqual(updated);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalStatus: 'APPROVED',
        role: 'EMPLOYEE',
        isActive: true,
        attendanceEligibleFrom: expect.any(Date),
      }),
    );
    expect(auditValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        actorUserId: ACTOR_ID,
        action: 'APPROVED',
      }),
    );
  });

  it('rejects a pending registration, disables it, and records the actor', async () => {
    const updated = {
      ...pendingUser(),
      approvalStatus: 'REJECTED' as const,
      isActive: false,
    };
    const { service, updateSet, auditValues } = makeService(updated);

    const result = await service.rejectRegistration(USER_ID, actor());

    expect(result).toEqual(updated);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalStatus: 'REJECTED',
        isActive: false,
        rejectedAt: expect.any(Date),
      }),
    );
    expect(auditValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        actorUserId: ACTOR_ID,
        action: 'REJECTED',
      }),
    );
  });
});
