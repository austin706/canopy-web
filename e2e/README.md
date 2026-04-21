# Canopy Web — Playwright E2E Smoke Tests

**Scope:** Five conversion-funnel smoke tests (DX-2 from `Product/CANOPY_DESIGN_AUDIT.md`).

## Run locally

```bash
npm run test:e2e:install   # one-time: install Playwright browser binaries
npm run test:e2e           # headless run
npm run test:e2e:ui        # interactive UI mode
```

Playwright starts the Vite dev server automatically. If you already have `npm run dev` running on 5173, it'll reuse it.

## What's covered

| # | Spec | Funnel step |
|---|------|-------------|
| 1 | `01-landing-to-signup.spec.ts` | Landing page CTA → `/signup` |
| 2 | `02-signup-to-onboarding.spec.ts` | Signup form submit → routes onward |
| 3 | `03-onboarding-to-dashboard.spec.ts` | Onboarded user lands on Dashboard (not `/onboarding`) |
| 4 | `04-dashboard-to-upgrade.spec.ts` | Upgrade/pricing page reachable from dashboard |
| 5 | `05-addon-quote-request.spec.ts` | `/add-ons` renders with quote CTA |

## How it works

Supabase + analytics network calls are stubbed via `page.route()` — see `fixtures/mocks.ts`. Tests never hit a real backend.

## CI

Runs on every push and PR via `.github/workflows/e2e.yml`. Failing tests block merge.

## Adding tests

Keep specs under 60s. Prefer ARIA roles (`getByRole`) and visible text (`getByText`) over CSS selectors — the landing/marketing surfaces change frequently.

If a test needs authenticated state, wire `stubSupabase(page, { authed: true, user, home })`.
