import { defineConfig, devices } from '@playwright/test';

/**
 * Canopy web — Playwright smoke-test suite for the conversion funnel.
 * Runs on every PR via GitHub Actions (.github/workflows/e2e.yml).
 *
 * Scope (DX-2 from CANOPY_DESIGN_AUDIT.md):
 *   1. landing → signup
 *   2. signup → onboarding step 3
 *   3. onboarding complete → dashboard
 *   4. dashboard → upgrade checkout
 *   5. add-on quote request
 *
 * Target median runtime: <60s per spec.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
