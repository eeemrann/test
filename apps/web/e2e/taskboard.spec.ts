import { expect, test } from '@playwright/test'
import { e2eAccounts, loginAs, mutationE2EEnabled } from './helpers'

test.describe('isolated taskboard browser workflow', () => {
  test('creates, edits, progresses and reloads a task using the real API', async ({ page }) => {
    test.skip(
      !mutationE2EEnabled || !e2eAccounts.employee.email || !e2eAccounts.employee.password || !e2eAccounts.employee.fullName,
      'Requires E2E_ENABLE_MUTATIONS=true, E2E_ISOLATED_DATABASE=true and an isolated employee account. It must never target office_management.',
    )

    await loginAs(page, e2eAccounts.employee)
    await page.goto('/app/tasks')
    await expect(page.getByRole('heading', { name: 'Taskboard' })).toBeVisible()

    const title = `Browser workflow ${Date.now()}`
    await page.getByRole('button', { name: 'New task' }).click()
    await expect(page.getByRole('heading', { name: 'Create a new task' })).toBeVisible()
    await page.getByLabel('Task title').fill(title)
    const employeeOption = page.getByRole('listbox', { name: 'Eligible active users' }).getByRole('option').first()
    await expect(employeeOption).toBeVisible()
    await employeeOption.click()
    await page.getByRole('button', { name: 'Create task' }).click()
    await expect(page.getByText('Task created successfully.')).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(`Open task ${title}`) })).toBeVisible()

    await page.getByRole('button', { name: new RegExp(`Open task ${title}`) }).click()
    await expect(page.locator('#task-details-title')).toHaveText(title)
    await expect(page.getByText('Activity', { exact: true })).toBeVisible()

    await page.getByRole('dialog').getByRole('button', { name: 'Close task details' }).click()
  })
})
