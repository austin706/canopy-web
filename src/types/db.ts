// ═══════════════════════════════════════════════════════════════
// db.ts — canonical row-type aliases (web)
// ═══════════════════════════════════════════════════════════════
// Phase-2 Group A (2026-05-06): purely-additive re-exports of the
// generated Database types. New code should `import { HomeRow }
// from '@/types/db'` for any DB row shape; existing hand-written
// `interface Home { ... }` etc. stay in place for now and will be
// migrated table-by-table in Group C.
//
// When schema changes:
//   1. Re-generate src/types/database.generated.ts via
//      Supabase MCP `generate_typescript_types`.
//   2. tsc — any column rename / removal lights up here at every
//      call site.
// ═══════════════════════════════════════════════════════════════

import type { Tables, TablesInsert, TablesUpdate } from './database.generated';

// ─── Row types (SELECT shape) ──────────────────────────────────
export type HomeAddOnRow = Tables<'home_add_ons'>;
export type VisitInspectionRow = Tables<'visit_inspections'>;
export type VisitInspectionItemRow = Tables<'visit_inspection_items'>;
export type MaintenanceTaskRow = Tables<'maintenance_tasks'>;
export type HomeTokenAttestationRow = Tables<'home_token_attestations'>;
export type ProMonthlyVisitRow = Tables<'pro_monthly_visits'>;
export type HomeRow = Tables<'homes'>;
export type ProfileRow = Tables<'profiles'>;
export type AgentRow = Tables<'agents'>;
export type ProProviderRow = Tables<'pro_providers'>;
export type EquipmentRow = Tables<'equipment'>;

// ─── Insert / Update shapes — opt-in via these aliases ─────────
// Generated `TablesInsert<'foo'>` and `TablesUpdate<'foo'>` mark
// columns with DB defaults as optional, so writes don't have to
// hand-pass `created_at`, etc. Import these only at the boundary
// where rows are actually written.
export type HomeAddOnInsert = TablesInsert<'home_add_ons'>;
export type VisitInspectionInsert = TablesInsert<'visit_inspections'>;
export type VisitInspectionItemInsert = TablesInsert<'visit_inspection_items'>;
export type MaintenanceTaskInsert = TablesInsert<'maintenance_tasks'>;
export type HomeTokenAttestationInsert = TablesInsert<'home_token_attestations'>;
export type ProMonthlyVisitInsert = TablesInsert<'pro_monthly_visits'>;
export type HomeInsert = TablesInsert<'homes'>;
export type ProfileInsert = TablesInsert<'profiles'>;
export type AgentInsert = TablesInsert<'agents'>;
export type ProProviderInsert = TablesInsert<'pro_providers'>;
export type EquipmentInsert = TablesInsert<'equipment'>;

export type HomeAddOnUpdate = TablesUpdate<'home_add_ons'>;
export type VisitInspectionUpdate = TablesUpdate<'visit_inspections'>;
export type VisitInspectionItemUpdate = TablesUpdate<'visit_inspection_items'>;
export type MaintenanceTaskUpdate = TablesUpdate<'maintenance_tasks'>;
export type HomeTokenAttestationUpdate = TablesUpdate<'home_token_attestations'>;
export type ProMonthlyVisitUpdate = TablesUpdate<'pro_monthly_visits'>;
export type HomeUpdate = TablesUpdate<'homes'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;
export type AgentUpdate = TablesUpdate<'agents'>;
export type ProProviderUpdate = TablesUpdate<'pro_providers'>;
export type EquipmentUpdate = TablesUpdate<'equipment'>;
