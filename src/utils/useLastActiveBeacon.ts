// ═══════════════════════════════════════════════════════════════
// useLastActiveBeacon — keep profiles.last_active_at fresh
// ═══════════════════════════════════════════════════════════════
// 2026-05-02 hotfix: AdminUserView and broadcast segmentation read
// profiles.last_active_at. The migration adds the column with a
// backfill from updated_at; this hook keeps it current as users
// actually use the app.
//
// Throttle: once per day per user (localStorage-keyed) so we don't
// hammer the DB on every dashboard render. The 1-day granularity is
// plenty for retention/churn segmentation.
//
// Usage: call from any authed-route container that mounts on every
// session. App.tsx layout / Dashboard / Profile are reasonable hosts.
// Failure is silent — this is a best-effort signal, not a hard
// dependency.
// ═══════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { supabase } from '@/services/supabase';

const STORAGE_KEY = 'canopy.lastActiveBeacon.lastSentAt';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function useLastActiveBeacon(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId) return;

    // Throttle: only fire once per day per user.
    let lastSent = 0;
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}.${userId}`);
      lastSent = raw ? Number(raw) : 0;
    } catch { /* ignore */ }

    if (Date.now() - lastSent < ONE_DAY_MS) return;

    // Fire-and-forget. Failure is non-blocking.
    (async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', userId);
        if (!error) {
          try {
            localStorage.setItem(`${STORAGE_KEY}.${userId}`, String(Date.now()));
          } catch { /* ignore */ }
        }
      } catch { /* non-blocking */ }
    })();
  }, [userId]);
}
