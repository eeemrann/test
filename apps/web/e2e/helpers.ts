import type { Page } from '@playwright/test'

export type E2EAccount = {
  email: string | undefined
  password: string | undefined
  fullName: string | undefined
  roleLabel: string
}

const isolatedFixtureDefaults = process.env.E2E_ISOLATED_DATABASE === 'true'
  ? {
      employeeEmail: 'e2e.eng.employee.one@office.local',
      employeeName: 'Engineering Employee One',
      managerEmail: 'e2e.eng.manager@office.local',
      managerName: 'Engineering Manager',
      adminEmail: 'e2e.admin@office.local',
      adminName: 'System Admin',
    }
  : null

export const e2eAccounts = {
  employee: {
    email: process.env.E2E_EMPLOYEE_EMAIL ?? isolatedFixtureDefaults?.employeeEmail,
    password: process.env.E2E_EMPLOYEE_PASSWORD,
    fullName: process.env.E2E_EMPLOYEE_NAME ?? isolatedFixtureDefaults?.employeeName,
    roleLabel: 'Employee',
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL ?? isolatedFixtureDefaults?.managerEmail,
    password: process.env.E2E_MANAGER_PASSWORD,
    fullName: process.env.E2E_MANAGER_NAME ?? isolatedFixtureDefaults?.managerName,
    roleLabel: 'Manager',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? isolatedFixtureDefaults?.adminEmail,
    password: process.env.E2E_ADMIN_PASSWORD,
    fullName: process.env.E2E_ADMIN_NAME ?? isolatedFixtureDefaults?.adminName,
    roleLabel: 'Administrator',
  },
} satisfies Record<string, E2EAccount>

export const authE2EEnabled = process.env.E2E_ENABLE_AUTH === 'true'
export const mutationE2EEnabled =
  authE2EEnabled &&
  process.env.E2E_ENABLE_MUTATIONS === 'true' &&
  process.env.E2E_ISOLATED_DATABASE === 'true'

export async function useUnauthenticatedBackend(page: Page): Promise<void> {
  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    })
  })
  await page.route('**/health/database', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 503, message: 'Database unavailable' }),
    })
  })
}

export function accountIsConfigured(account: E2EAccount): boolean {
  return Boolean(account.email && account.password && account.fullName)
}

export async function loginAs(page: Page, account: E2EAccount): Promise<void> {
  if (!account.email || !account.password || !account.fullName) {
    throw new Error('The requested E2E account is not configured.')
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/app(?:$|\/)/)
  await page.getByText(account.fullName, { exact: true }).first().waitFor()
  await page.getByText(account.roleLabel, { exact: true }).first().waitFor()
}
