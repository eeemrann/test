import { defineConfig } from '@playwright/test'

const isolatedE2E = process.env.E2E_ISOLATED_DATABASE === 'true'
const baseURL = process.env.E2E_BASE_URL ?? (isolatedE2E ? 'http://127.0.0.1:5175' : 'http://127.0.0.1:5173')
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/usr/bin/chromium'
const apiBaseURL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3002'

const webServer = isolatedE2E
  ? [
      {
        command: 'VITE_API_URL=http://127.0.0.1:3002 npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      {
        command: 'npm --prefix ../api run start:e2e',
        url: `${apiBaseURL}/health/database`,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
    ]
  : {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe' as const,
      stderr: 'pipe' as const,
    }

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  timeout: 30_000,
  expect: {
    timeout: 7_000,
  },
  fullyParallel: false,
  workers: isolatedE2E ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The environment has Chromium but not Playwright's optional ffmpeg bundle.
    // Traces and failure screenshots remain enabled without requiring a download.
    video: 'off',
    launchOptions: {
      executablePath: chromiumPath,
    },
  },
  webServer: process.env.E2E_EXTERNAL_SERVER === 'true' ? undefined : webServer,
})
