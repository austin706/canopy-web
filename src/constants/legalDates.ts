// Canopy-Web/src/constants/legalDates.ts
// P3 #75 (2026-04-23) — single source of truth for "Last updated" dates on
// legal/policy pages. Previously each page hardcoded its own ISO-like string
// (e.g., "April 14, 2026"), which drifted across pages and was easy to forget
// to update when copy actually changed. Importing from one file lets us:
//
//  1. Audit the whole policy stack at a glance to see what's stale.
//  2. Change a single constant when a policy revision ships.
//  3. Keep machine-readable ISO + human-readable display in lockstep.
//
// When updating: edit BOTH the ISO string and the display string so the two
// forms don't diverge. Use `formatLegalDate(iso)` when adding a new page so
// the display form is generated deterministically.

export interface LegalDate {
  /** ISO 8601 date the policy was last revised (YYYY-MM-DD). */
  iso: string;
  /** Human-readable form rendered on the page. Keep in sync with `iso`. */
  display: string;
}

function formatLegalDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function asLegalDate(iso: string): LegalDate {
  return { iso, display: formatLegalDate(iso) };
}

export const LEGAL_DATES = {
  terms: asLegalDate('2026-04-14'),
  privacy: asLegalDate('2026-04-11'),
  cancellation: asLegalDate('2026-04-14'),
  aiDisclaimer: asLegalDate('2026-04-03'),
  pciCompliance: asLegalDate('2026-04-03'),
  contractorTerms: asLegalDate('2026-04-03'),
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DATES;

/**
 * Returns the date a PCI-DSS SAQ-A self-assessment review is next due.
 * PCI compliance requires re-attestation at least once every 12 months.
 * Deriving it from `pciCompliance.iso` keeps the two dates in lockstep
 * rather than hardcoding a second calendar string that can drift.
 */
export function pciAnnualReviewDueDate(): LegalDate {
  const last = new Date(`${LEGAL_DATES.pciCompliance.iso}T00:00:00Z`);
  const next = new Date(last);
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  const iso = next.toISOString().slice(0, 10);
  return asLegalDate(iso);
}
