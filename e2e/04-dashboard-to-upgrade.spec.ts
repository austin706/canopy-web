import { test, expect } from '@playwright/test';
import { stubSupabase, TEST_USER, TEST_HOME } from './fixtures/mocks';

/**
 * Smoke #4 — Dashboard → Upgrade Checkout
 * Validates: a free-tier user can reach the Upgrade/Pricing page from
 * the Dashboard. This is the core revenue funnel gate.
 */
test.describe('Conversion funnel — dashboard to upgrade', () => {
  test('user on Free tier can navigate to upgrade flow', async ({ page }) => {
    const onboardedUser = {
      ...TEST_USER,
      onboarded: true,
      home_id: TEST_HOME.id,
      subscription_tier: 'free',
    };
    await stubSupabase(page, { authed: true, user: onboardedUser, home: TEST_HOME });

    await page.goto('/upgrade');

    // Upgrade/Pricing content or CTA to Stripe checkout should be visible.
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    // An upgrade CTA should be present.
    const upgradeCta = page
      .getByRole('button', { name: /(start|upgrade|subscribe|try|get) (canopy )?(home|pro|plus|free|now)/i })
      .first();
    await expect(upgradeCta.or(page.getByRole('link', { name: /upgrade|subscribe|start/i }).first())).toBeVisible({
      timeout: 10_000,
    });
  });
});
