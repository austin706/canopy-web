import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';
import { stubSupabase, TEST_USER } from './fixtures/mocks';

/**
 * Smoke #6 — VerifyEmail gate (signup → verify → onboarding)
 *
 * Validates the post-signup verification gate that replaced the old
 * SignupSuccess upsell on 2026-04-27. The contract:
 *   1. Unverified user lands on /verify-email and sees the gate UI.
 *   2. Resend tap returns success without leaving the page.
 *   3. The moment the user's email_confirmed_at flips from null to a
 *      timestamp, the polling loop routes them to /onboarding.
 *
 * Coverage gap closed: this is the critical handoff between sign-up
 * and the onboarding funnel. Field-level resend bugs or polling
 * regressions silently strand users on the gate (no redirect, no
 * onboarding completion, no revenue). Prior to this spec, the gate
 * had no automated coverage.
 */

test.describe('Conversion funnel — verify-email gate', () => {
  test('unverified user sees the gate, can resend, stays on page', async ({ page }) => {
    await stubSupabase(page, { authed: true });

    // Track resend attempts so we can assert the button hit Supabase.
    let resendCalls = 0;
    await page.route(/\/auth\/v1\/resend/, (r: Route) => {
      resendCalls += 1;
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('/verify-email');

    // Gate UI rendered. Heading text varies between revisions, so anchor
    // on the always-present "Resend" CTA + the user's email address.
    await expect(page.getByText(/check your inbox|verify your email|verification/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(TEST_USER.email)).toBeVisible();

    // Resend button is enabled on first load (no cooldown yet).
    const resend = page.getByRole('button', { name: /resend|send.*again/i }).first();
    await expect(resend).toBeEnabled();
    await resend.click();

    // Resend hit Supabase, status flipped to "sent" copy.
    await expect.poll(() => resendCalls, { timeout: 5_000 }).toBeGreaterThan(0);
    await expect(page.getByText(/sent|on its way|check your inbox/i).first()).toBeVisible();

    // Still on the verification gate — we never confirmed the email.
    await expect(page).toHaveURL(/\/verify-email/);
  });

  test('verified user is redirected to onboarding by the polling loop', async ({ page }) => {
    // Override stubSupabase's /auth/v1/user route with a confirmed user
    // before any other routes attach so the page sees a confirmed user
    // on first poll.
    const confirmedUser = {
      ...TEST_USER,
      email_confirmed_at: new Date().toISOString(),
    };

    await page.route(/\/auth\/v1\/user/, (r: Route) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(confirmedUser),
      }),
    );

    await stubSupabase(page, { authed: true, user: confirmedUser as typeof TEST_USER });
    await page.goto('/verify-email');

    // Polling effect calls supabase.auth.getUser() on mount and every 4s.
    // With email_confirmed_at populated, the page should replace into
    // /onboarding within the first poll.
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });
});
