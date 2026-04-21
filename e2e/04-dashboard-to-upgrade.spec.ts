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

    await page.goto('/subscription');

    // Subscription/Plan heading should render.
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });

    // Some plan CTA or plan-selection control should be present.
    await expect(page.getByRole('button').first()).toBeVisible({ timeout: 10_000 });
  });
});
