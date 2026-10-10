import { expect, test } from '@playwright/test'
import { useUnauthenticatedBackend } from './helpers'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test.describe(`${viewport.name} public layout`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('keeps the public and login surfaces usable without horizontal overflow', async ({ page }, testInfo) => {
      await useUnauthenticatedBackend(page)
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'A calmer way to run the office.' })).toBeVisible()
      await expect(page.locator('body')).toHaveJSProperty('scrollWidth', viewport.width)
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-home.png`), fullPage: true })

      await page.goto('/login')
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
      await expect(page.locator('body')).toHaveJSProperty('scrollWidth', viewport.width)
      await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-login.png`), fullPage: true })
    })
  })
}
