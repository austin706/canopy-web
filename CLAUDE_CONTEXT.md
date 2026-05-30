# Canopy-Web Context — pointer file (updated 2026-05-21)

The previous content of this file was March-era and contained stale claims (Pro+ as a tier, USPS as live, etc.). It has been replaced with this short pointer.

**For current launch state, read:**
- `../Audit_2026-05-21/CANOPY_LAUNCH_STATE.md` — the canonical launch-readiness doc
- `../Audit_2026-05-21/02_web.md` — the most recent web audit (2026-05-21)

**Key locked rules** (verify before assuming):
- Pro+ tier was killed 2026-04-29. "Pro+ services" is the umbrella for à la carte add-ons, NOT a subscription tier.
- USPS address verification was killed 2026-05; legacy code remains but is dormant.
- Web is Stripe-only for payments. IAP is mobile-only.
- Real estate agents are LEAD SOURCES (no commission). Certified Pros are CONTRACTORS (15% fee). Never conflate.
- Web and mobile must stay in feature parity.

**Repo layout** (React + Vite + React Router v6):
- `src/pages/` — route components
- `src/components/` — shared UI (ui/, icons/)
- `src/services/` — Supabase, payments
- `src/store/` — Zustand stores
- `src/constants/` — pricing, theme, etc.
- `src/data/` — static content (changelog, etc.)
- `src/contexts/` — React context providers
