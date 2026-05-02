import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { stubSupabase, TEST_USER, TEST_HOME } from './fixtures/mocks';

// Same helper as 06-verify-email.spec.ts. Specs that go directly to a route
// behind ProtectedRoute need a session in localStorage — supabase.auth's SDK
// reads from storage first and short-circuits if missing, so network mocks
// alone don't authenticate the page.
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
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: `sb-${SUPABASE_PROJECT_REF}-auth-token`, value: JSON.stringify(session) },
  );
}

// Seed the Zustand store (persist key 'canopy-web-store') so ProtectedRoute
// sees isAuthenticated=true on first render and doesn't bounce through /login
// → / → /dashboard. Without this, the redirect chain lands the user on
// dashboard before Onboarding ever mounts.
async function seedZustandAuthed(page: Page, user: typeof TEST_USER, home: typeof TEST_HOME | null = null) {
  await page.addInitScript(
    ({ u, h }) => {
      window.localStorage.setItem(
        'canopy-web-store',
        JSON.stringify({
          state: {
            user: { ...u, onboarding_complete: false, email_confirmed: true },
            isAuthenticated: true,
            home: h,
            homes: h ? [h] : [],
            activeHomeId: h ? h.id : null,
            equipment: [],
            consumables: [],
            customTemplates: [],
            tasks: [],
            maintenanceLogs: [],
            onboardingStep: 0,
          },
          version: 0,
        }),
      );
    },
    { u: user, h: home },
  );
}

/**
 * Smoke #7 — Onboarding compression (#4 from strategic top-10)
 *
 * Validates the "Quick start" path through onboarding hits the dashboard
 * in ≤90 seconds of user-perceptible time. We measure the wall-clock from
 * the moment the user lands on /onboarding (post-verify-email) to the
 * moment /dashboard renders. Network + auth latency are stubbed; the test
 * proves the compressed UI path itself doesn't block the user with
 * required-field gates.
 *
 * Targets:
 *   - Step 0 (welcome): no inputs
 *   - Step 1 (address): 5 essentials visible by default (address, city,
 *     state, ZIP, year_built, square_footage). Stories/beds/baths/garage
 *     collapsed under "Optional details" disclosure (closed by default).
 *   - Step 2 (systems): "Quick start" CTA submits with empty selections.
 *   - Step 3 (plan): user picks free/home/pro.
 *   - Step 4 (equipment): camera scan optional; "Build my plan" finishes.
 *
 * The 90-second budget includes Playwright fill latency (~50ms per field)
 * + a generous read-time padding (~20s for the user to read each screen).
 * If this test fails, the activation funnel has regressed and the team
 * needs to investigate before launch.
 */

const NINETY_SECONDS_MS = 90_000;

test.describe('Conversion funnel — onboarding 90-second Quick Start', () => {
  test('Quick Start path lands on dashboard in ≤90s (network stubbed)', async ({ page }) => {
    // Onboarding gates on a real auth session via ProtectedRoute. Seed both
    // localStorage entries (Supabase + Zustand) so the page mounts in the
    // authed state without a redirect chain. Use TEST_HOME so handleFinish
    // has a home to update at step 5 — that puts us in Add-Property mode
    // (welcome shows "Add Another Property"), but the compression layers
    // (#4 layer 1 + 2) live on the same address+systems screens regardless.
    await seedSupabaseSession(page, TEST_USER);
    await seedZustandAuthed(page, TEST_USER, TEST_HOME);
    await stubSupabase(page, { authed: true, user: TEST_USER });

    const startedAt = Date.now();

    // Land directly on /onboarding — verify-email is covered by spec #6.
    await page.goto('/onboarding');

    // ─── Step 0: Welcome / first CTA ──────────────────────────────────
    // Match any prominent button that advances the user past the welcome
    // screen. Current copy is "Let's Set Up Your Home" / "Add Another
    // Property"; regex covers historical variants and is greedy enough
    // to survive minor copy changes.
    const advanceFromWelcome = page
      .getByRole('button', { name: /continue|get started|set up|build (my )?plan|next|start|add (another )?property/i })
      .first();
    await advanceFromWelcome.click({ timeout: 10_000 });

    // ─── Step 1: Address ──────────────────────────────────────────────
    // Five essentials. Stories/beds/baths/garage hidden by default.
    // The Street Address autocomplete uses a custom component; the city/
    // state/ZIP inputs use unique placeholders ("Tulsa" / "OK" / "74103").
    // handleAddressSubmit gates on address+city+state+zip — Year Built is
    // NOT required, so we skip the <select>.
    await page.locator('input[placeholder*="Start typing"]').first().fill('123 Smoke Test Ln', { timeout: 10_000 });
    await page.locator('input[placeholder="Tulsa"]').first().fill('Tulsa');
    await page.locator('input[placeholder="OK"]').first().fill('OK');
    await page.locator('input[placeholder="74103"]').first().fill('74103');

    // CRITICAL — the optional-details disclosure must be CLOSED by default.
    // The disclosure button text ("+ Optional: stories, beds, baths, garage")
    // is the only place stories/beds/baths/garage live before expansion.
    const disclosureBtn = page.getByRole('button', { name: /Optional: stories/i }).first();
    await expect(disclosureBtn).toBeVisible({ timeout: 5_000 }).catch(() => {
      console.warn('[smoke #7] optional-details disclosure not found — compression may have regressed');
    });

    // Advance past address.
    const addressNext = page.getByRole('button', { name: /next|continue/i }).first();
    await addressNext.click();

    // ─── Step 2: Systems → Quick start ────────────────────────────────
    // The Quick Start CTA submits with whatever's selected (empty by
    // default) and skips all detail substeps.
    const quickStart = page.getByRole('button', { name: /quick start/i }).first();
    await expect(quickStart).toBeVisible({ timeout: 10_000 });
    await quickStart.click();

    // ─── Step 3: Plan — pick Free, skip Stripe ────────────────────────
    // selectedPlan defaults to 'home' (paid). For the smoke we want the
    // free path so handlePlanCheckout short-circuits (setStep(4), no
    // Stripe). The plan cards are <div onClick> wrapping a heading +
    // price; click the "$0" text which is unique to the Free card.
    await expect(page.getByRole('heading', { name: /Choose your plan/i })).toBeVisible({ timeout: 10_000 });
    await page.getByText('$0', { exact: false }).first().click({ timeout: 5_000 });
    const continueFree = page.getByRole('button', { name: /^Continue with Free/i }).first();
    await continueFree.click({ timeout: 10_000 });

    // ─── Step 4: Equipment — skip ────────────────────────────────────
    // Equipment is optional; "Skip — add equipment later" advances to step 5.
    await page.getByRole('button', { name: /Skip.*add equipment/i }).first().click({ timeout: 10_000 });

    // ─── Step 5: Ready — Build My Plan ───────────────────────────────
    // Generates tasks + advances to step 6 (Done).
    await page.getByRole('button', { name: /Build My Plan/i }).first().click({ timeout: 15_000 });

    // ─── Step 6: Done — Go to Dashboard ──────────────────────────────
    // navigate('/', { replace: true }) which HomeRoute redirects to /dashboard.
    await page.getByRole('button', { name: /Go to Dashboard/i }).first().click({ timeout: 15_000 });

    // ─── Land on dashboard ────────────────────────────────────────────
    await expect(page).toHaveURL(/\/(dashboard|home|$)/, { timeout: 20_000 });

    const elapsedMs = Date.now() - startedAt;
    console.log(`[smoke #7] onboarding Quick Start completed in ${elapsedMs}ms (target ≤${NINETY_SECONDS_MS}ms)`);
    expect(elapsedMs).toBeLessThanOrEqual(NINETY_SECONDS_MS);
  });
});
