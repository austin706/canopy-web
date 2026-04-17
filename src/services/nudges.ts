import { supabase } from '@/services/supabase';
import logger from '@/utils/logger';

/**
 * Dismiss a nudge category via RPC, storing the dismissal timestamp
 * in the user's profile.dismissed_nudges JSONB column.
 * Dismissed nudges won't re-appear for 30 days.
 */
export async function dismissNudge(nudgeKey: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('dismiss_nudge', {
      p_nudge_key: nudgeKey,
    });
    if (error) {
      logger.warn(`Failed to dismiss nudge "${nudgeKey}":`, error.message);
      throw error;
    }
  } catch (err) {
    logger.error(`dismissNudge failed for key "${nudgeKey}":`, err);
    throw err;
  }
}

/**
 * Reset a nudge category via RPC, removing it from dismissed_nudges
 * so it can be shown again immediately.
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
 * Check if a nudge should be shown based on dismissal timestamp.
 * Returns true if the nudge is NOT dismissed or was dismissed > 30 days ago.
 */
export function isNudgeActive(
  dismissedNudges: Record<string, number> | null | undefined,
  nudgeKey: string,
): boolean {
  if (!dismissedNudges || !(nudgeKey in dismissedNudges)) {
    return true; // Not dismissed = active
  }

  const dismissedTimestamp = dismissedNudges[nudgeKey];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return dismissedTimestamp < thirtyDaysAgo; // Dismissed > 30 days ago = active
}
