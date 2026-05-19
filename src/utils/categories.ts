// ───────────────────────────────────────────────────────────────────
// categories.ts — humanize task / equipment category strings for display.
//
// 2026-05-18: task_templates uses snake_case category values like
// `water_heater` and `pest_control`. They were leaking through to the UI
// raw with the underscore visible. This helper title-cases consistently.
//
// Safe to apply to any string: pass-through if no underscores, idempotent.
// ───────────────────────────────────────────────────────────────────

export function humanizeCategory(category: string | null | undefined): string {
  if (!category) return '';
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
