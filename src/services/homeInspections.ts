// ═══════════════════════════════════════════════════════════════
// Home Inspections · service layer (web)
// ═══════════════════════════════════════════════════════════════
// 2026-05-02: Wraps the record_certified_inspection RPC and the
// homeowner-facing read paths against the home_inspections table.
// HMAC stamping happens server-side; the client never touches the key.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/services/supabase';

export type InspectionGrade = 'excellent' | 'good' | 'fair' | 'needs_attention';

/**
 * Per-system findings entry. Free-form on purpose so inspectors can
 * capture nuance, but the shape is opinionated enough that the buyer-
 * facing PDF / share view can render it cleanly.
 */
export interface InspectionFinding {
  /** Machine-friendly system tag, e.g. 'hvac' / 'roof' / 'plumbing' */
  system: string;
  /** Short human-readable label */
  label: string;
  /** Per-item grade (mirrors overall grade vocabulary) */
  grade: InspectionGrade;
  /** Inspector notes (markdown-ish; rendered as plain text in PDF). */
  notes?: string;
  /** Optional photo URLs attached to this finding. */
  photos?: string[];
}

export interface RecommendedRepair {
  title: string;
  urgency: 'now' | 'this_year' | 'monitor';
  estimated_cost_low?: number;
  estimated_cost_high?: number;
  notes?: string;
}

export interface HomeInspectionRecord {
  id: string;
  home_id: string;
  inspector_id: string;
  inspector_name: string;
  inspector_credential_number: string | null;
  inspected_at: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  overall_grade: InspectionGrade;
  systems_inspected: Record<string, InspectionFinding[]> | InspectionFinding[];
  findings: InspectionFinding[];
  recommended_repairs: RecommendedRepair[];
  photo_urls: string[];
  pdf_certificate_url: string | null;
  signed_record: string;
  signed_at: string;
  signature_version: number;
  price_charged_cents: number | null;
  inspector_payout_cents: number | null;
  add_on_visit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmitInspectionParams {
  homeId: string;
  inspectorName: string;
  inspectorCredentialNumber?: string | null;
  overallGrade: InspectionGrade;
  /** Top-level structured findings (per system). */
  findings: InspectionFinding[];
  /** Bag of system-level metadata (e.g. counts, notes). */
  systemsInspected?: Record<string, unknown>;
  recommendedRepairs?: RecommendedRepair[];
  photoUrls?: string[];
  durationMinutes?: number;
  priceChargedCents?: number;
  inspectorPayoutCents?: number;
  addOnVisitId?: string | null;
}

/** Submit a completed inspection · wraps record_certified_inspection. */
export async function submitInspection(p: SubmitInspectionParams): Promise<HomeInspectionRecord> {
  const { data, error } = await supabase.rpc('record_certified_inspection', {
    p_home_id: p.homeId,
    p_inspector_name: p.inspectorName,
    p_inspector_credential_number: p.inspectorCredentialNumber ?? null,
    p_overall_grade: p.overallGrade,
    p_systems_inspected: (p.systemsInspected ?? {}) as object,
    p_findings: (p.findings ?? []) as object,
    p_recommended_repairs: (p.recommendedRepairs ?? []) as object,
    p_photo_urls: p.photoUrls ?? [],
    p_duration_minutes: p.durationMinutes ?? null,
    p_price_charged_cents: p.priceChargedCents ?? null,
    p_inspector_payout_cents: p.inspectorPayoutCents ?? null,
    p_add_on_visit_id: p.addOnVisitId ?? null,
  });
  if (error) throw error;
  const record = data as HomeInspectionRecord;
  // Fire-and-forget: generate the buyer-facing PDF certificate. We don't
  // block the inspector on this · failure here shows up in edge fn logs
  // but the inspection itself is already persisted + email-on-completion
  // trigger has already fired.
  generateCertificatePdf(record.id).catch(() => { /* observed via edge logs */ });
  return record;
}

/**
 * Trigger PDF certificate generation. Returns the public PDF URL once the
 * edge function completes. Awaitable for clients that want to surface the
 * URL immediately; otherwise call as fire-and-forget · the URL is also
 * written back to home_inspections.pdf_certificate_url server-side.
 */
export async function generateCertificatePdf(inspectionId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('generate-inspection-certificate', {
    body: { inspection_id: inspectionId },
  });
  if (error) {
    // Don't throw · the inspection record is the source of truth; the PDF
    // can be regenerated later if needed.
    return null;
  }
  return (data as { url?: string })?.url ?? null;
}

/** List inspections for a home, newest first. */
export async function listInspectionsForHome(homeId: string): Promise<HomeInspectionRecord[]> {
  const { data, error } = await supabase
    .from('home_inspections')
    .select('*')
    .eq('home_id', homeId)
    .order('inspected_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as HomeInspectionRecord[];
}

/** Get a single inspection by id. */
export async function getInspection(inspectionId: string): Promise<HomeInspectionRecord | null> {
  const { data, error } = await supabase
    .from('home_inspections')
    .select('*')
    .eq('id', inspectionId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as HomeInspectionRecord | null;
}

/** Inspector-facing: list inspections I've conducted, newest first. */
export async function listInspectionsByInspector(): Promise<HomeInspectionRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('home_inspections')
    .select('*')
    .eq('inspector_id', user.id)
    .order('inspected_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as HomeInspectionRecord[];
}

/**
 * Upload an inspection photo to the public `inspection-photos` bucket.
 * Returns the public URL the inspector can attach to a finding or the
 * top-level photo_urls array on the inspection.
 */
export async function uploadInspectionPhoto(
  homeId: string,
  file: File | Blob,
  filename?: string,
): Promise<string> {
  const ext = (filename ?? (file instanceof File ? file.name : 'photo.jpg'))
    .split('.').pop() || 'jpg';
  const path = `homes/${homeId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('inspection-photos')
    .upload(path, file, { contentType: (file as File).type || 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('inspection-photos').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Compute the inspection price for a given home's square footage,
 * mirroring add_on_categories pricing rules:
 *   base $0/mo + $0.05/sqft, clamped to [$149, $299]/yr.
 * Returns total cents and inspector payout cents (65% of total).
 */
export function computeInspectionPrice(squareFootage: number | null | undefined): {
  totalCents: number;
  inspectorPayoutCents: number;
  canopyMarginCents: number;
} {
  const sqft = squareFootage ?? 0;
  let dollars = 0.05 * sqft;
  if (dollars < 149) dollars = 149;
  if (dollars > 299) dollars = 299;
  const total = Math.round(dollars * 100);
  const payout = Math.round(total * 0.65);
  return { totalCents: total, inspectorPayoutCents: payout, canopyMarginCents: total - payout };
}

/**
 * Default inspection systems · the minimum coverage we want a Canopy
 * certified inspection to walk through. Inspectors can edit or extend.
 */
export const DEFAULT_INSPECTION_SYSTEMS: Array<{ system: string; label: string }> = [
  { system: 'hvac',           label: 'HVAC (heating + cooling)' },
  { system: 'water_heater',   label: 'Water heater' },
  { system: 'plumbing',       label: 'Plumbing · supply, drain, fixtures' },
  { system: 'electrical',     label: 'Electrical · panel, outlets, GFCI/AFCI' },
  { system: 'roof',           label: 'Roof · shingles, flashings, gutters' },
  { system: 'foundation',     label: 'Foundation + structural' },
  { system: 'exterior',       label: 'Exterior envelope · siding, windows, doors' },
  { system: 'attic_insulation', label: 'Attic + insulation' },
  { system: 'kitchen',        label: 'Kitchen · appliances, plumbing, ventilation' },
  { system: 'bathrooms',      label: 'Bathrooms · fixtures, ventilation, tile' },
  { system: 'safety_alarms',  label: 'Smoke/CO alarms + fire extinguishers' },
  { system: 'garage',         label: 'Garage · door, opener, sensors' },
];
