// ===============================================================
// Supabase Client & Base Configuration
// ===============================================================
// 2026-05-06: production schema canonical types live in
// src/types/database.generated.ts (re-generate via Supabase MCP
// generate_typescript_types when the schema changes). New code SHOULD
// import `Tables<'foo'>` from there for any DB row shape; existing
// hand-written interfaces are being migrated incrementally to avoid a
// massive nullable-mismatch tsc storm.
import { createClient } from '@supabase/supabase-js';
import logger from '@/utils/logger';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Guard against missing environment variables
if (!SUPABASE_URL) {
  logger.error('VITE_SUPABASE_URL is not configured — Supabase client will not function');
}
if (!SUPABASE_ANON_KEY) {
  logger.error('VITE_SUPABASE_ANON_KEY is not configured — Supabase client will not function');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Disable navigator.locks — Supabase uses Web Locks API to serialize
    // auth operations, but if any operation (e.g. signOut network POST)
    // hangs, the lock is held forever and ALL subsequent auth calls
    // (getSession, signIn, onAuthStateChange) deadlock permanently.
    // With flowType 'implicit' and a custom lock that's a simple no-op
    // wrapper, we avoid this class of bugs entirely.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      // Execute the callback directly without acquiring navigator.locks
      return fn();
    },
  },
});

// --- Auth Rate Limiting (S10: client-side rate limiting on auth endpoints) ---
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT = 5;       // max attempts
const AUTH_RATE_WINDOW = 60_000; // per 1 minute

export function checkAuthRateLimit(action: string): void {
  const now = Date.now();
  const entry = authAttempts.get(action);
  if (entry && now < entry.resetAt) {
    if (entry.count >= AUTH_RATE_LIMIT) {
      const waitSec = Math.ceil((entry.resetAt - now) / 1000);
      throw new Error(`Too many attempts. Please wait ${waitSec} seconds and try again.`);
    }
    entry.count++;
  } else {
    authAttempts.set(action, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
  }
}
