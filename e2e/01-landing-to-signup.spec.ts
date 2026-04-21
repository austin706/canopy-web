import { test, expect } from '@playwright/test';
import { stubSupabase } from './fixtures/mocks';

/**
 * Smoke #1 — Landing → Signup
 * Validates: landing page loads, primary CTA is discoverable, click
 * transitions to /signup with the signup form rendered.
 */
test.describe('Conversion funnel — landing to signup', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page, { authed: false, user: null, home: null });
  });

  test('primary hero CTA navigates to /signup', async ({ page }) => {
    await page.goto('/');
    // Landing headline should appear.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

    // Click the first "Get Started" style CTA.
    const cta = page.getByRole('button', { name: /get started/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(/\/signup/);
    // Signup form should be present (email + password inputs).
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });
});
