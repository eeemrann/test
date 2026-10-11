import { expect, test, type Page } from '@playwright/test'
import { e2eAccounts, loginAs, mutationE2EEnabled } from './helpers'

const requireIsolatedAccounts = () => {
  test.skip(
    !mutationE2EEnabled ||
      !e2eAccounts.employee.email || !e2eAccounts.employee.password || !e2eAccounts.employee.fullName ||
      !e2eAccounts.manager.email || !e2eAccounts.manager.password || !e2eAccounts.manager.fullName ||
      !e2eAccounts.admin.email || !e2eAccounts.admin.password || !e2eAccounts.admin.fullName,
    'Requires the isolated database, live API, and configured E2E account passwords.',
  )
}

async function chooseEmployee(page: Page, name: string) {
  const option = page.getByRole('listbox', { name: 'Eligible active users' }).getByRole('option').filter({ hasText: name }).first()
  await expect(option).toBeVisible()
  await option.click()
}

test.describe('isolated browser acceptance', () => {
  test('employee can create, edit, filter, drag, complete, and inspect activity', async ({ page }) => {
    requireIsolatedAccounts()
    await loginAs(page, e2eAccounts.employee)
    await page.goto('/app/tasks')
    await expect(page.getByRole('heading', { name: 'Taskboard' })).toBeVisible()

    const title = `e2e-acceptance-employee-${Date.now()}`
    const editedTitle = `${title}-edited`
    await page.getByRole('button', { name: 'New task' }).click()
    await page.getByLabel('Task title').fill(title)
    await chooseEmployee(page, e2eAccounts.employee.fullName!)
    await page.getByRole('button', { name: 'Create task' }).click()
    await expect(page.getByText('Task created successfully.')).toBeVisible()

    await page.getByRole('button', { name: `Open task ${title}` }).click()
    await expect(page.locator('#task-details-title')).toHaveText(title)
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Task title').fill(editedTitle)
    await page.getByLabel('Description').fill('Edited by the isolated browser acceptance flow.')
    await page.locator('#edit-task-priority').selectOption('HIGH')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Task updated successfully.')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Close task details' }).click()

    await page.getByPlaceholder('Search task titles and descriptions').fill(editedTitle)
    await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('HIGH')
    const card = page.getByRole('button', { name: `Open task ${editedTitle}` })
    await expect(card).toBeVisible()

    const sourceBox = await card.boundingBox()
    const targetBox = await page.getByLabel('Working tasks').boundingBox()
    expect(sourceBox).not.toBeNull()
    expect(targetBox).not.toBeNull()
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 24, sourceBox!.y + sourceBox!.height / 2, { steps: 5 })
    await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 20 })
    await page.mouse.up()
    await expect(page.getByText('Task moved to Working.')).toBeVisible()

    await card.click()
    await expect(page.getByRole('button', { name: 'Mark as done' })).toBeVisible()
    await page.getByRole('button', { name: 'Mark as done' }).click()
    await expect(page.getByText('Task marked done.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Task activity history' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Task activity entries' })).toContainText('Status changed')
    await page.getByRole('dialog').getByRole('button', { name: 'Close task details' }).click()
  })

  test('manager stays team-scoped while admin can reassign across teams', async ({ browser }) => {
    requireIsolatedAccounts()
    const managerContext = await browser.newContext()
    const employeeContext = await browser.newContext()
    const adminContext = await browser.newContext()
    const managerPage = await managerContext.newPage()
    const employeePage = await employeeContext.newPage()
    const adminPage = await adminContext.newPage()
    const title = `e2e-acceptance-reassignment-${Date.now()}`

    try {
      await loginAs(managerPage, e2eAccounts.manager)
      await managerPage.goto('/app/tasks')
      await managerPage.getByRole('button', { name: 'New task' }).click()
      await managerPage.getByLabel('Task title').fill(title)
      await chooseEmployee(managerPage, 'Engineering Employee One')
      await managerPage.getByRole('button', { name: 'Create task' }).click()
      await expect(managerPage.getByText('Task created successfully.')).toBeVisible()
      await managerPage.getByRole('button', { name: `Open task ${title}` }).click()
      await managerPage.getByRole('button', { name: 'Reassign', exact: true }).click()
      const managerDialog = managerPage.getByRole('dialog').filter({ hasText: 'Reassign task' })
      await expect(managerDialog.getByRole('option').filter({ hasText: 'Engineering Employee Two' })).toBeVisible()
      await expect(managerDialog.getByRole('option').filter({ hasText: 'Operations Employee One' })).toHaveCount(0)
      await managerDialog.getByRole('button', { name: 'Close Reassign task' }).click()
      await managerPage.getByRole('dialog').getByRole('button', { name: 'Close task details' }).click()

      await loginAs(employeePage, e2eAccounts.employee)
      await employeePage.goto('/app/tasks')
      await employeePage.getByPlaceholder('Search task titles and descriptions').fill(title)
      await employeePage.getByRole('button', { name: `Open task ${title}` }).click()
      await expect(employeePage.getByRole('button', { name: 'Reassign', exact: true })).toHaveCount(0)
      await employeePage.getByRole('dialog').getByRole('button', { name: 'Close task details' }).click()

      await loginAs(adminPage, e2eAccounts.admin)
      await adminPage.goto('/app/tasks')
      await adminPage.getByPlaceholder('Search task titles and descriptions').fill(title)
      await adminPage.getByRole('button', { name: `Open task ${title}` }).click()
      await adminPage.getByRole('button', { name: 'Reassign', exact: true }).click()
      const adminDialog = adminPage.getByRole('dialog').filter({ hasText: 'Reassign task' })
      await adminDialog.getByRole('option').filter({ hasText: 'Operations Employee One' }).click()
      await adminDialog.getByRole('button', { name: 'Confirm reassignment' }).click()
      await expect(adminPage.getByText('Task reassigned successfully.')).toBeVisible()
    } finally {
      await managerContext.close()
      await employeeContext.close()
      await adminContext.close()
    }
  })

  test('realtime assignment reaches the recipient and shared-session logout affects another tab', async ({ browser }) => {
    requireIsolatedAccounts()
    const creatorContext = await browser.newContext()
    const recipientContext = await browser.newContext()
    const creator = await creatorContext.newPage()
    const recipient = await recipientContext.newPage()
    const secondTab = await recipientContext.newPage()

    try {
      await loginAs(recipient, e2eAccounts.employee)
      await recipient.goto('/app/notifications')
      await expect(recipient.getByRole('heading', { name: 'Notifications' })).toBeVisible()
      await recipient.getByRole('button', { name: 'Mark all read' }).click()
      await expect(recipient.getByRole('button', { name: 'Notifications, none unread' })).toBeVisible()

      await secondTab.goto('/app')
      await expect(secondTab.getByText(e2eAccounts.employee.fullName!, { exact: true }).first()).toBeVisible()
      await secondTab.goto('/app/notifications')
      await secondTab.getByRole('button', { name: 'Mark all read' }).click()
      await expect(secondTab.getByRole('button', { name: 'Notifications, none unread' })).toBeVisible()
      await secondTab.goto('/app')

      await loginAs(creator, e2eAccounts.manager)
      await creator.goto('/app/tasks')
      await creator.getByRole('button', { name: 'New task' }).click()
      await creator.getByLabel('Task title').fill(`e2e-acceptance-realtime-${Date.now()}`)
      await chooseEmployee(creator, e2eAccounts.employee.fullName!)
      await creator.getByRole('button', { name: 'Create task' }).click()

      await expect(
        recipient.getByRole('heading', { name: 'Task assigned' }).last(),
      ).toBeVisible({ timeout: 15_000 })
      await secondTab.reload()
      await expect(secondTab.getByRole('button', { name: /Notifications, [1-9]\d* unread/ })).toBeVisible({ timeout: 15_000 })

      await recipient.getByRole('button', { name: new RegExp(e2eAccounts.employee.fullName!, 'i') }).click()
      await recipient.getByRole('menuitem', { name: 'Sign out' }).click()
      await secondTab.reload()
      await expect(secondTab).toHaveURL(/\/login$/)
      await expect(secondTab.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    } finally {
      await creatorContext.close()
      await recipientContext.close()
    }
  })
})
