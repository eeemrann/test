import { expect, test } from '@playwright/test'
import { useUnauthenticatedBackend } from './helpers'

test.describe('public browser smoke checks', () => {
  test.beforeEach(async ({ page }) => {
    await useUnauthenticatedBackend(page)
  })

  test('loads the public home page and reports the backend state honestly', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'A calmer way to run the office.' })).toBeVisible()
    await expect(page.getByText('Backend connection')).toBeVisible()
    await expect(page.getByText('Backend Disconnected')).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('renders a usable login form after an unauthenticated refresh', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('shows the frontend invalid-credentials state for an unauthorized login', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password.' }),
      })
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill('invalid@example.test')
    await page.getByRole('textbox', { name: 'Password' }).fill('not-a-real-password')
    await page.locator('main').getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toContainText('Invalid email or password.')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('does not present a network failure as invalid credentials', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.abort('failed')
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill('employee@example.test')
    await page.getByRole('textbox', { name: 'Password' }).fill('not-a-real-password')
    await page.locator('main').getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toContainText('backend is unavailable')
    await expect(page.getByRole('alert')).not.toContainText('Invalid email or password')
  })

  test('handles an unknown public route with the not-found page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to dashboard' })).toBeVisible()
  })
})
