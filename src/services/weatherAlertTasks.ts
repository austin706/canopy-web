// ═══════════════════════════════════════════════════════════════
// Weather Alert → Task Auto-Sync (no-op stub)
// ═══════════════════════════════════════════════════════════════
//
// 2026-05-19 — this client function is intentionally a no-op. The
// authoritative path is the server-side `generate-weather-tasks` edge
// function, which runs every 4 hours via pg_cron (job 25), uses the
// `weather_events_processed` ledger for idempotency, and writes via the
// SECURITY DEFINER `generate_weather_task` RPC.
//
// We keep this stub in place so the Dashboard hook contract is stable. If
// we ever want to give the user a "sync now" path for sub-4h latency, the
// right move is a small companion edge fn that takes user auth + home_id,
// verifies home ownership, then delegates to the same RPC. That's deferred
// until we have evidence the 4h cadence isn't fast enough.
//
// Web parity: Canopy-App/services/weatherAlertTasks.ts.

import type { Home, MaintenanceTask, WeatherAlert } from '@/types';

export interface SyncResult {
  created: number;
  soft_deleted: number;
}

export async function syncWeatherAlertTasks(
  _home: Home,
  _alerts: WeatherAlert[],
  _existingTasks: MaintenanceTask[],
): Promise<SyncResult> {
  // Authoritative sync runs server-side. See header.
  return { created: 0, soft_deleted: 0 };
}
