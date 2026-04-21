/**
 * dashboardPriority — DD-10 "next action" scoring engine.
 *
 * Deterministic, pure. Ranks dashboard items by a numeric score so the UI can
 * render a single "Your next action" hero card plus a rail of secondary items.
 *
 * Scoring weights (from CANOPY_DESIGN_AUDIT.md DD-10):
 *   overdue                       100
 *   due within 7 days              80
 *   weather-driven                 60
 *   setup-checklist incomplete     40
 *   add-on nudge                   20
 *
 * Tiebreakers (in order):
 *   1. higher priority (urgent > high > medium > low)
 *   2. earlier due date
 *   3. stable sort by id
 *
 * The function accepts a `now: Date` for deterministic testing; callers in
 * production pass `new Date()`.
 *
 * Keep this file in sync with `Canopy-App/utils/dashboardPriority.ts` — both
 * must have identical logic. Shared-module-less by design because the two
 * codebases live side by side, not in a monorepo.
 */

export const DASHBOARD_PRIORITY_WEIGHTS = {
  overdue: 100,
  dueWithin7Days: 80,
  weatherDriven: 60,
  setupIncomplete: 40,
  addonNudge: 20,
} as const;

export type DashboardPriorityReason =
  | 'overdue'
  | 'due_soon'
  | 'weather'
  | 'setup'
  | 'addon';

export type DashboardPrioritySource = 'task' | 'setup' | 'addon';

/** Shape the scoring engine expects for tasks. Intentionally minimal so both
 *  web + mobile task types can be narrowed down to it without a full import. */
export interface PriorityTaskInput {
  id: string;
  title: string;
  category: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'upcoming' | 'due' | 'overdue' | 'completed' | 'skipped';
  due_date: string;
  is_weather_triggered?: boolean;
  weather_trigger_type?: string | null;
}

/** Shape of a setup checklist item (e.g., "Add HVAC", "Upload deed"). */
export interface PrioritySetupInput {
  id: string;
  label: string;
  /** True when the step is already done (will be filtered out). */
  complete: boolean;
  /** Optional deep-link target (e.g., "/home-details#hvac"). */
  href?: string;
}

/** Shape of an add-on suggestion shown on the dashboard. */
export interface PriorityAddonInput {
  id: string;
  label: string;
  /** Tier-gated? If true and the user's tier is insufficient, we still
   *  surface it but it becomes an upgrade CTA. */
  gated?: boolean;
  href?: string;
}

export interface DashboardPriorityItem {
  /** Stable synthetic id: `task:<id>`, `setup:<id>`, or `addon:<id>`. */
  id: string;
  /** Numeric score; higher = more important. */
  score: number;
  /** Why this item bubbled up. */
  reason: DashboardPriorityReason;
  /** Where this item came from. */
  source: DashboardPrioritySource;
  /** Display label (e.g., "Clean gutters — overdue by 3 days"). */
  label: string;
  /** Short tag shown as a chip ("Overdue", "Due Wed", "Weather alert"). */
  badge: string;
  /** Optional deep-link target for the card's primary CTA. */
  href?: string;
  /** Pass-through reference to the source row for the renderer. */
  ref?: unknown;
}

const PRIORITY_RANK: Record<PriorityTaskInput['priority'], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Whole-day diff between `a` and `b`, truncating to midnight local time. */
function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function parseDue(raw: string): Date | null {
  if (!raw) return null;
  // Accept YYYY-MM-DD or full ISO. Default time to local 9am to match
  // `_layout.tsx` push notification scheduler.
  const hasTime = raw.includes('T');
  const iso = hasTime ? raw : `${raw}T09:00:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function humanDay(date: Date, now: Date): string {
  const days = diffDays(date, now);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) {
    const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `Due ${weekday}`;
  }
  return `Due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export interface ComputeDashboardPriorityArgs {
  tasks: PriorityTaskInput[];
  setup?: PrioritySetupInput[];
  addons?: PriorityAddonInput[];
  now?: Date;
  /** Max items returned (default 8 — one hero + rail). */
  limit?: number;
}

/**
 * Score every candidate item and return the top `limit` items sorted by
 * descending score with stable tiebreakers.
 */
export function computeDashboardPriority({
  tasks,
  setup = [],
  addons = [],
  now = new Date(),
  limit = 8,
}: ComputeDashboardPriorityArgs): DashboardPriorityItem[] {
  const items: DashboardPriorityItem[] = [];

  // ── Tasks ─────────────────────────────────────────────────────────────
  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'skipped') continue;
    const due = parseDue(task.due_date);
    if (!due) continue;
    const deltaDays = diffDays(due, now);

    let score = 0;
    let reason: DashboardPriorityReason | null = null;
    let badge = '';

    if (task.status === 'overdue' || deltaDays < 0) {
      score = DASHBOARD_PRIORITY_WEIGHTS.overdue;
      reason = 'overdue';
      badge = 'Overdue';
    } else if (task.is_weather_triggered) {
      score = DASHBOARD_PRIORITY_WEIGHTS.weatherDriven;
      reason = 'weather';
      badge = task.weather_trigger_type
        ? `${task.weather_trigger_type.charAt(0).toUpperCase()}${task.weather_trigger_type.slice(1)} alert`
        : 'Weather alert';
    } else if (deltaDays >= 0 && deltaDays <= 7) {
      score = DASHBOARD_PRIORITY_WEIGHTS.dueWithin7Days;
      reason = 'due_soon';
      badge = humanDay(due, now);
    } else {
      continue; // later tasks don't belong in the next-action surface
    }

    // Priority multiplier: urgent tasks bump their score by +1..+4 to break
    // ties against same-reason items of lower priority.
    score += PRIORITY_RANK[task.priority] ?? 0;

    items.push({
      id: `task:${task.id}`,
      score,
      reason,
      source: 'task',
      label: task.title,
      badge,
      href: `/task/${task.id}`,
      ref: task,
    });
  }

  // ── Setup checklist ──────────────────────────────────────────────────
  for (const step of setup) {
    if (step.complete) continue;
    items.push({
      id: `setup:${step.id}`,
      score: DASHBOARD_PRIORITY_WEIGHTS.setupIncomplete,
      reason: 'setup',
      source: 'setup',
      label: step.label,
      badge: 'Finish setup',
      href: step.href,
      ref: step,
    });
  }

  // ── Add-on nudges ────────────────────────────────────────────────────
  for (const addon of addons) {
    items.push({
      id: `addon:${addon.id}`,
      score: DASHBOARD_PRIORITY_WEIGHTS.addonNudge - (addon.gated ? 1 : 0),
      reason: 'addon',
      source: 'addon',
      label: addon.label,
      badge: addon.gated ? 'Pro service' : 'Suggested',
      href: addon.href,
      ref: addon,
    });
  }

  items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreaker 1: earlier due date wins (only comparable across tasks)
    const ta = (a.ref as PriorityTaskInput | undefined)?.due_date;
    const tb = (b.ref as PriorityTaskInput | undefined)?.due_date;
    if (ta && tb && ta !== tb) return ta < tb ? -1 : 1;
    // Tiebreaker 2: stable id sort
    return a.id.localeCompare(b.id);
  });

  return items.slice(0, limit);
}

/** Convenience: just the hero card (highest-scored item, or null). */
export function pickHeroAction(
  args: ComputeDashboardPriorityArgs,
): DashboardPriorityItem | null {
  return computeDashboardPriority({ ...args, limit: 1 })[0] ?? null;
}
