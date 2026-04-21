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

    // Request-quote style CTA should exist for at least one service.
    const quoteCta = page
      .getByRole('button', { name: /(request|get) (a )?quote|book|learn more/i })
      .first();
    await expect(
      quoteCta.or(page.getByRole('link', { name: /quote|book|details/i }).first()),
    ).toBeVisible({ timeout: 10_000 });
  });
});
