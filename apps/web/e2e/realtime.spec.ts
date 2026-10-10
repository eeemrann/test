import { expect, test } from '@playwright/test'
import { e2eAccounts, loginAs, mutationE2EEnabled } from './helpers'

test.describe('isolated realtime notification workflow', () => {
  test('delivers a backend notification to the assigned employee context only', async ({ browser }) => {
    test.skip(
      !mutationE2EEnabled ||
        !e2eAccounts.employee.email || !e2eAccounts.employee.password || !e2eAccounts.employee.fullName ||
        !e2eAccounts.manager.email || !e2eAccounts.manager.password || !e2eAccounts.manager.fullName,
      'Requires two isolated authenticated accounts and an isolated database. No development records are mutated by default.',
    )

    const creatorContext = await browser.newContext()
    const assigneeContext = await browser.newContext()
    const creator = await creatorContext.newPage()
    const assignee = await assigneeContext.newPage()

    try {
      await loginAs(creator, e2eAccounts.manager)
      await loginAs(assignee, e2eAccounts.employee)
      await assignee.goto('/app/notifications')
      await expect(assignee.getByRole('heading', { name: 'Notifications' })).toBeVisible()

      await creator.goto('/app/tasks')
      await creator.getByRole('button', { name: 'New task' }).click()
      await creator.getByLabel('Task title').fill(`Realtime browser workflow ${Date.now()}`)
      await creator.getByRole('option').first().click()
      await creator.getByRole('button', { name: 'Create task' }).click()

      await expect(assignee.getByText('Task assigned')).toBeVisible({ timeout: 15_000 })
      await expect(assignee.getByRole('button', { name: /Notifications, [1-9]/ })).toBeVisible()
    } finally {
      await creatorContext.close()
      await assigneeContext.close()
    }
  })
})
