import { supabase } from '@/services/supabase';
import logger from '@/utils/logger';

/**
 * Per-key dismissal record stored in `profiles.dismissed_nudges` JSONB.
 * - `count` increments on every dismissal.
 * - `last_dismissed_at` drives the 30-day debounce.
 * - `count >= MAX_DISMISSALS_BEFORE_PERMANENT` stops the nudge permanently.
 */
export interface DismissalRecord {
  count: number;
  last_dismissed_at: string; // ISO timestamp
}

export type DismissedNudgesMap = Record<string, DismissalRecord>;

export const MAX_DISMISSALS_BEFORE_PERMANENT = 3;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Dismiss a nudge key via RPC. Returns the new dismissal count so callers can
 * detect the 3rd-strike transition (for a one-time "we'll stop suggesting X"
 * toast) without a follow-up SELECT.
 */
export async function dismissNudge(nudgeKey: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('dismiss_nudge', {
      p_nudge_key: nudgeKey,
    });
    if (error) {
      logger.warn(`Failed to dismiss nudge "${nudgeKey}":`, error.message);
      throw error;
    }
    // RPC returns integer count; guard against nulls defensively.
    const count = typeof data === 'number' ? data : Number(data) || 1;
    return count;
  } catch (err) {
    logger.error(`dismissNudge failed for key "${nudgeKey}":`, err);
    throw err;
  }
}

/**
 * Reset a nudge via RPC. Removes the key entirely, letting the nudge fire
 * again on the next opportunity. Used by the "show this again" settings row.
 */
export async function resetNudge(nudgeKey: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('reset_nudge', {
      p_nudge_key: nudgeKey,
    });
    if (error) {
      logger.warn(`Failed to reset nudge "${nudgeKey}":`, error.message);
      throw error;
    }
  } catch (err) {
    logger.error(`resetNudge failed for key "${nudgeKey}":`, err);
    throw err;
  }
}

/**
 * Read the current user's dismissed_nudges JSONB from the profile.
 * Returns an empty map on any failure so callers can always render.
 */
export async function fetchDismissedNudges(): Promise<DismissedNudgesMap> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    const { data, error } = await supabase
      .from('profiles')
      .select('dismissed_nudges')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      logger.warn('fetchDismissedNudges error', error.message);
      return {};
    }
    const raw = (data?.dismissed_nudges ?? {}) as Record<string, unknown>;
    return normalizeDismissals(raw);
  } catch (err) {
    logger.error('fetchDismissedNudges failed:', err);
    return {};
  }
}

/**
 * Normalize legacy shape (plain ISO-string values) to the new
 * DismissalRecord shape. Safe to call on already-normalized maps.
 */
export function normalizeDismissals(raw: Record<string, unknown>): DismissedNudgesMap {
  const out: DismissedNudgesMap = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (typeof value === 'string') {
      out[key] = { count: 1, last_dismissed_at: value };
    } else if (value && typeof value === 'object') {
      const rec = value as Record<string, unknown>;
      const count = typeof rec.count === 'number' ? rec.count : Number(rec.count) || 1;
      const last = typeof rec.last_dismissed_at === 'string'
        ? rec.last_dismissed_at
        : new Date().toISOString();
      out[key] = { count, last_dismissed_at: last };
    }
  }
  return out;
}

/**
 * Returns true if a nudge should currently show. Conditions:
 * - Never dismissed, or
 * - Dismissed but count < MAX_DISMISSALS_BEFORE_PERMANENT AND more than 30 days ago.
 */
export function isNudgeActive(
  dismissedNudges: DismissedNudgesMap | Record<string, unknown> | null | undefined,
  nudgeKey: string,
): boolean {
  if (!dismissedNudges) return true;
  const map = normalizeDismissals(dismissedNudges as Record<string, unknown>);
  const rec = map[nudgeKey];
  if (!rec) return true;
  if (rec.count >= MAX_DISMISSALS_BEFORE_PERMANENT) return false;
  const lastMs = Date.parse(rec.last_dismissed_at);
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= THIRTY_DAYS_MS;
}

/**
 * Returns true if a nudge has been dismissed permanently (count >= 3).
 */
export function isNudgePermanent(
  dismissedNudges: DismissedNudgesMap | Record<string, unknown> | null | undefined,
  nudgeKey: string,
): boolean {
  if (!dismissedNudges) return false;
  const map = normalizeDismissals(dismissedNudges as Record<string, unknown>);
  const rec = map[nudgeKey];
  return !!rec && rec.count >= MAX_DISMISSALS_BEFORE_PERMANENT;
}
