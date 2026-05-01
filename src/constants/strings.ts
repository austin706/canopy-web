// ═══════════════════════════════════════════════════════════════
// Canopy web — canonical strings + brand identifiers
// ═══════════════════════════════════════════════════════════════
// Single source of truth for product copy and contact details that
// appear in multiple places. Centralizing prevents drift when the
// brand or support routing changes (e.g. moving from
// support@canopyhome.app to a different inbox).
//
// 2026-04-29 (Phase 1F): created. Mobile mirror lives at
// Canopy-App/constants/strings.ts.
//
// Pricing strings live in `pricing.ts`, not here.
// Email-specific brand colors / sender identity live in `theme.ts`
// (EmailBrand) — those are inputs to transactional email rendering,
// not user-visible app copy.
// ═══════════════════════════════════════════════════════════════

export const BRAND = {
  name: 'Canopy',
  fullName: 'Canopy Home',
  tagline: "The home maintenance app that thinks like a homeowner",
  domain: 'canopyhome.app',
  shortDomain: 'canopyhome.app',
} as const;

export const CONTACT = {
  /** Generic support address — surface in error states, alerts, help screens. */
  supportEmail: 'support@canopyhome.app',
  /** Transactional sender — used in email rendering only. */
  transactionalEmail: 'info@canopyhome.app',
  /** Sales / Pro+ inquiries. */
  salesEmail: 'sales@canopyhome.app',
} as const;

export const COPY = {
  /** Generic retry prompt body for unexpected errors. */
  genericErrorRetry:
    "Something unexpected happened on our end. Try again — if it keeps failing, email support@canopyhome.app and we'll fix it for you.",
  /** Generic loading state. */
  loading: 'Loading…',
  /** Empty state when no tasks exist yet. */
  noTasksYet:
    "No tasks yet — finish setting up your home and we'll build your maintenance plan automatically.",
} as const;

/**
 * URL helpers for cross-app deep links and store listings.
 * Keep app-store URLs in their own file if they grow beyond this.
 */
export const URLS = {
  webApp: 'https://canopyhome.app',
  privacyPolicy: 'https://canopyhome.app/privacy',
  termsOfService: 'https://canopyhome.app/terms',
  helpCenter: 'https://canopyhome.app/help',
} as const;
