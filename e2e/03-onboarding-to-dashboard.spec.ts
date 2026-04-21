import { test, expect } from '@playwright/test';
import { stubSupabase, TEST_USER, TEST_HOME } from './fixtures/mocks';

/**
 * Smoke #3 — Onboarding complete → Dashboard
 * Validates: a user whose `onboarded=true` + has a home lands on the
 * Dashboard (not bounced back to /onboarding).
 */
test.describe('Conversion funnel — onboarded user sees dashboard', () => {
  test('onboarded user with home lands on Dashboard, not onboarding', async ({ page }) => {
    const onboardedUser = { ...TEST_USER, onboarded: true, home_id: TEST_HOME.id };
    await stubSupabase(page, { authed: true, user: onboardedUser, home: TEST_HOME });

    await page.goto('/');

    // Should NOT be redirected to /onboarding.
    await expect(page).not.toHaveURL(/\/onboarding/, { timeout: 10_000 });

    // Dashboard greeting or some element rendered.
    const dashboardMarker = page.getByRole('heading').first();
    await expect(dashboardMarker).toBeVisible({ timeout: 10_000 });
  });
});
