import { test, expect } from '@playwright/test';
import { stubSupabase, TEST_USER, TEST_HOME } from './fixtures/mocks';

/**
 * Smoke #5 — Add-on quote request
 * Validates: the /add-ons landing page renders and a service card
 * request-quote CTA is reachable. Covers the Tulsa add-on revenue surface.
 */
test.describe('Conversion funnel — add-on quote request', () => {
  test('add-ons landing loads with at least one service CTA', async ({ page }) => {
    const onboardedUser = {
      ...TEST_USER,
      onboarded: true,
      home_id: TEST_HOME.id,
      subscription_tier: 'home',
    };
    await stubSupabase(page, { authed: true, user: onboardedUser, home: TEST_HOME });

    await page.goto('/add-ons');

    // Heading should render (Add-On Services / similar copy).
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    // At least one primary CTA should be present on the add-ons landing page.
    const cta = page
      .getByRole('button', { name: /get started|start your canopy|request|quote|learn more|sign up/i })
      .first();
    await expect(
      cta.or(page.getByRole('link', { name: /get started|signup|start|quote/i }).first()),
    ).toBeVisible({ timeout: 10_000 });
  });
});
