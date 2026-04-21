import type { Page, Route } from '@playwright/test';

/**
 * Shared Playwright network stubs for Canopy smoke tests.
 *
 * Goal: exercise the UI without needing a real Supabase backend.
 * Strategy: match every request by URL substring and return a minimal
 * JSON payload the client happily consumes.
 *
 * Keep these lean. Smoke tests validate flows (URL transitions, form
 * submission success, rendered headings) — not backend correctness.
 */

export const TEST_USER_ID = 'test-user-00000000-0000-0000-0000-000000000001';
export const TEST_HOME_ID = 'test-home-00000000-0000-0000-0000-000000000002';

export const TEST_USER = {
  id: TEST_USER_ID,
  email: 'smoketest@canopy.test',
  full_name: 'Smoke Tester',
  onboarded: false,
  subscription_tier: 'free',
  home_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const TEST_HOME = {
  id: TEST_HOME_ID,
  user_id: TEST_USER_ID,
  address: '123 Smoke Test Ln',
  city: 'Tulsa',
  state: 'OK',
  zip_code: '74102',
  created_at: new Date().toISOString(),
};

/**
 * Wire up a set of Supabase stubs. All Supabase REST + auth endpoints are
 * intercepted; anything not matched falls through to real network (which
 * will fail — on purpose, so we catch missed routes).
 */
export async function stubSupabase(
  page: Page,
  opts: {
    user?: typeof TEST_USER | null;
    home?: typeof TEST_HOME | null;
    authed?: boolean;
  } = {},
) {
  const user = opts.user === null ? null : opts.user || TEST_USER;
  const home = opts.home === null ? null : opts.home || TEST_HOME;
  const authed = opts.authed ?? false;

  // Sentry — swallow.
  await page.route(/ingest\.sentry\.io|sentry-cdn|sentry\.io/, (r: Route) => r.fulfill({ status: 200, body: '{}' }));

  // GA4 / analytics pings — swallow.
  await page.route(/google-analytics\.com|googletagmanager\.com|analytics\.google\.com/, (r: Route) =>
    r.fulfill({ status: 200, body: '' }),
  );

  // Supabase auth — session check on page load.
  await page.route(/\/auth\/v1\/user/, (r: Route) => {
    if (!authed) {
      return r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'not authed' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
  });

  await page.route(/\/auth\/v1\/session/, (r: Route) => {
    if (!authed) return r.fulfill({ status: 401, body: '{}' });
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        user,
      }),
    });
  });

  // Supabase sign-up — always succeeds.
  await page.route(/\/auth\/v1\/signup/, (r: Route) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user,
        session: { access_token: 'test-token', refresh_token: 'test-refresh', user },
      }),
    }),
  );

  // Supabase sign-in — always succeeds.
  await page.route(/\/auth\/v1\/token/, (r: Route) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        user,
      }),
    }),
  );

  // Profiles table — return our test user.
  await page.route(/\/rest\/v1\/profiles/, (r: Route) => {
    const method = r.request().method();
    if (method === 'GET' || method === 'HEAD') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user ? [user] : []) });
    }
    // POST / PATCH — echo back.
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([user]) });
  });

  // Homes table.
  await page.route(/\/rest\/v1\/homes/, (r: Route) => {
    const method = r.request().method();
    if (method === 'GET' || method === 'HEAD') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(home ? [home] : []) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([home]) });
  });

  // Generic REST fallback — return empty array for anything unmatched.
  await page.route(/\/rest\/v1\//, (r: Route) => {
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // Edge functions — return empty success.
  await page.route(/\/functions\/v1\//, (r: Route) => {
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
}
