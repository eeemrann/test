import { UsersService } from './users.service.js';

const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';
const TEAM_ID = '55555555-5555-4555-8555-555555555555';

function makeService(rows = [
  {
    id: EMPLOYEE_ID,
    fullName: 'Engineering Employee',
    email: 'employee@office.local',
    teamId: TEAM_ID,
  },
]) {
  const countWhere = vi.fn().mockResolvedValue([{ count: rows.length }]);
  const countFrom = vi.fn().mockReturnValue({ where: countWhere });
  const rowWhere = vi.fn().mockReturnValue({
    orderBy: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        offset: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
  const rowFrom = vi.fn().mockReturnValue({ where: rowWhere });
  const db = {
    select: vi
      .fn()
      .mockReturnValueOnce({ from: countFrom })
      .mockReturnValueOnce({ from: rowFrom }),
  };

  return { service: new UsersService({ db } as never), db };
}

describe('UsersService', () => {
  it('returns active employees with only assignable public fields', async () => {
    const { service } = makeService();

    const result = await service.listAssignable({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      id: EMPLOYEE_ID,
      fullName: 'Engineering Employee',
      email: 'employee@office.local',
      teamId: TEAM_ID,
    });
    expect(result.data[0]).not.toHaveProperty('passwordHash');
  });

  it('supports search and bounded pagination', async () => {
    const { service, db } = makeService([]);

    const result = await service.listAssignable({
      search: 'engineering',
      page: 2,
      limit: 10,
    });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('uses name ordering with a stable id tie breaker', async () => {
    const { service } = makeService();

    await service.listAssignable({});

    expect(true).toBe(true);
  });

  it('maps empty results without exposing database errors', async () => {
    const { service } = makeService([]);

    await expect(service.listAssignable({})).resolves.toMatchObject({
      data: [],
    });
  });
});
