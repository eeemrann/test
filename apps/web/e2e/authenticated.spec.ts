import { expect, test } from '@playwright/test'
import { accountIsConfigured, authE2EEnabled, e2eAccounts, loginAs } from './helpers'

const accounts = Object.entries(e2eAccounts)

for (const [name, account] of accounts) {
  test(`${name} can authenticate, refresh the page and sign out`, async ({ page }) => {
    test.skip(!authE2EEnabled || !accountIsConfigured(account), 'Set E2E_ENABLE_AUTH=true and the ignored E2E account variables to run live authentication checks.')

    await loginAs(page, account)
    await expect(page).toHaveURL(/\/app$/)

    await page.reload()
    await expect(page.getByText(account.fullName!, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(account.roleLabel, { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: new RegExp(account.fullName!, 'i') }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByText(account.fullName!, { exact: true })).toHaveCount(0)
  })
}
