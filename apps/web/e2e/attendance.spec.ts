import { expect, test } from '@playwright/test'
import { e2eAccounts, loginAs, mutationE2EEnabled } from './helpers'

function requireLiveIsolatedAccounts() {
  test.skip(
    !mutationE2EEnabled ||
      !e2eAccounts.employee.email || !e2eAccounts.employee.password || !e2eAccounts.employee.fullName ||
      !e2eAccounts.manager.email || !e2eAccounts.manager.password || !e2eAccounts.manager.fullName ||
      !e2eAccounts.admin.email || !e2eAccounts.admin.password || !e2eAccounts.admin.fullName,
    'Requires the live API, isolated database, and configured isolated account passwords.',
  )
}

test.describe('registration and attendance browser workflows', () => {
  test('submits public registration and shows pending approval feedback', async ({ page }) => {
    requireLiveIsolatedAccounts()
    const email = `browser-registration-${Date.now()}@office.local`

    await page.goto('/register')
    await page.getByLabel('Full name').fill('Browser Registration Employee')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Browser.Password.123')
    await page.getByLabel('Confirm password').fill('Browser.Password.123')
    await page.getByRole('button', { name: 'Submit registration' }).click()

    await expect(page.getByRole('status')).toContainText('waiting for admin approval')
  })

  test('admin can view and approve the live pending registration', async ({ page }) => {
    requireLiveIsolatedAccounts()
    const email = `browser-admin-registration-${Date.now()}@office.local`

    await page.goto('/register')
    await page.getByLabel('Full name').fill('Browser Admin Review Employee')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Browser.Password.123')
    await page.getByLabel('Confirm password').fill('Browser.Password.123')
    await page.getByRole('button', { name: 'Submit registration' }).click()
    await expect(page.getByRole('status')).toBeVisible()

    await loginAs(page, e2eAccounts.admin)
    await page.goto('/app/admin/registrations')
    await expect(page.getByRole('heading', { name: 'Registration approvals' })).toBeVisible()
    const row = page.getByText(email).locator('..').locator('..')
    await expect(row).toContainText('PENDING')
    await row.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText(email)).toHaveCount(0)
  })

  test('employee checks in through the real API, refreshes, and sees the monthly record', async ({ page }) => {
    requireLiveIsolatedAccounts()
    await loginAs(page, e2eAccounts.employee)
    await page.goto('/app/attendance')
    const todayResponse = page.waitForResponse((response) => response.url().includes('/attendance/today') && response.status() === 200)
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible()
    await todayResponse
    await expect(page.getByRole('button', { name: /Check in/ })).toBeVisible()

    await page.getByRole('button', { name: /Check in/ }).click()
    await expect(page.getByRole('button', { name: /Check out/ })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Present days')).toBeVisible()
    await expect(page.getByText('Monthly history')).toBeVisible()
    await expect(page.getByRole('button', { name: /Check out/ })).toBeVisible()
  })

  test('manager and admin see their authorized attendance dashboards', async ({ browser }) => {
    requireLiveIsolatedAccounts()
    const managerContext = await browser.newContext()
    const adminContext = await browser.newContext()
    const manager = await managerContext.newPage()
    const admin = await adminContext.newPage()

    try {
      await loginAs(manager, e2eAccounts.manager)
      await manager.goto('/app/attendance')
      await expect(manager.getByRole('heading', { name: 'Team attendance records', exact: true })).toBeVisible()
      await expect(manager.getByText('Engineering Employee One')).toBeVisible()

      await loginAs(admin, e2eAccounts.admin)
      await admin.goto('/app/attendance')
      await expect(admin.getByText('Staff observation')).toBeVisible()
      await expect(admin.getByText('Approved active staff')).toBeVisible()
      await expect(admin.getByText('Engineering Employee One')).toBeVisible()
    } finally {
      await managerContext.close()
      await adminContext.close()
    }
  })

  test('surfaces attendance backend failures and remains usable on mobile', async ({ page }) => {
    requireLiveIsolatedAccounts()
    await loginAs(page, e2eAccounts.employee)
    await page.route('**/attendance/me*', async (route) => route.abort('failed'))
    await page.goto('/app/attendance')
    await expect(page.getByRole('alert')).toContainText('backend is unavailable')

    await page.unroute('**/attendance/me*')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible()
    const dimensions = await page.evaluate(() => ({ width: document.body.scrollWidth, viewport: window.innerWidth }))
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport)
  })
})
