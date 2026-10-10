export const e2eAccountEmails = {
  admin: process.env.E2E_ADMIN_EMAIL ?? 'admin@office.local',
  engineeringManager:
    process.env.E2E_MANAGER_EMAIL ?? 'eng.manager@office.local',
  operationsManager:
    process.env.E2E_OPERATIONS_MANAGER_EMAIL ?? 'ops.manager@office.local',
  engineeringEmployee:
    process.env.E2E_EMPLOYEE_EMAIL ?? 'eng.employee@office.local',
  operationsEmployee:
    process.env.E2E_OPERATIONS_EMPLOYEE_EMAIL ?? 'ops.employee@office.local',
};

export function testPassword(seedVariable: string): string {
  const e2eVariable = seedVariable.replace(/^SEED_/, 'E2E_');
  const password = process.env[e2eVariable] ?? process.env[seedVariable];

  if (!password) {
    throw new Error(`${e2eVariable} is required for local e2e tests`);
  }

  return password;
}
