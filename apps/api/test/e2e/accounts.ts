const isolatedFixtureDefaults = process.env.E2E_ISOLATED_DATABASE === 'true'
  ? {
      admin: 'e2e.admin@office.local',
      engineeringManager: 'e2e.eng.manager@office.local',
      operationsManager: 'e2e.ops.manager@office.local',
      engineeringEmployee: 'e2e.eng.employee.one@office.local',
      operationsEmployee: 'e2e.ops.employee.one@office.local',
    }
  : {
      admin: 'admin@office.local',
      engineeringManager: 'eng.manager@office.local',
      operationsManager: 'ops.manager@office.local',
      engineeringEmployee: 'eng.employee@office.local',
      operationsEmployee: 'ops.employee@office.local',
    };

export const e2eAccountEmails = {
  admin: process.env.E2E_ADMIN_EMAIL ?? isolatedFixtureDefaults.admin,
  engineeringManager:
    process.env.E2E_MANAGER_EMAIL ?? isolatedFixtureDefaults.engineeringManager,
  operationsManager:
    process.env.E2E_OPERATIONS_MANAGER_EMAIL ?? isolatedFixtureDefaults.operationsManager,
  engineeringEmployee:
    process.env.E2E_EMPLOYEE_EMAIL ?? isolatedFixtureDefaults.engineeringEmployee,
  operationsEmployee:
    process.env.E2E_OPERATIONS_EMPLOYEE_EMAIL ?? isolatedFixtureDefaults.operationsEmployee,
};

export function testPassword(seedVariable: string): string {
  const e2eVariable = seedVariable.replace(/^SEED_/, 'E2E_');
  const password = process.env[e2eVariable] ?? process.env[seedVariable];

  if (!password) {
    throw new Error(`${e2eVariable} is required for local e2e tests`);
  }

  return password;
}
