import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
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

// Pre-populate the Supabase auth-token entry in localStorage before the page
// boots. Sibling specs reach this state by going through the signup flow
// (which writes localStorage as a side effect). This spec lands on
// /verify-email directly, so we need to seed the session ourselves —
// otherwise supabase.auth.getUser() reads no session from storage and
// short-circuits before the network mock ever runs.
//
// The storage key is sb-{projectRef}-auth-token, where projectRef is the
// subdomain of VITE_SUPABASE_URL. CI injects ci-placeholder.supabase.co;
// local dev reads the real ref from .env. Derive at test-time so both work.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://uxxrmyxoyesipprwlxrn.supabase.co';
const SUPABASE_PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
async function seedSupabaseSession(page: Page, user: typeof TEST_USER) {
  const session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: `sb-${SUPABASE_PROJECT_REF}-auth-token`, value: JSON.stringify(session) },
  );
}

test.describe('Conversion funnel — verify-email gate', () => {
  test('unverified user sees the gate, can resend, stays on page', async ({ page }) => {
    await seedSupabaseSession(page, TEST_USER);
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

    await seedSupabaseSession(page, confirmedUser as typeof TEST_USER);
    await stubSupabase(page, { authed: true, user: confirmedUser as typeof TEST_USER });
    await page.goto('/verify-email');

    // Polling effect calls supabase.auth.getUser() on mount and every 4s.
    // With email_confirmed_at populated, the page should replace into
    // /onboarding within the first poll.
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });
});
