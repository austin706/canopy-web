// ═══════════════════════════════════════════════════════════════
// Recall Monitoring Service — CPSC recall matches for user equipment
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabaseClient';

export interface RecallMatch {
  id: string;
  recall_id: string;
  equipment_id: string;
  user_id: string;
  match_type: 'auto' | 'manual_confirmed' | 'manual_dismissed';
  match_confidence: 'high' | 'medium' | 'low';
  notified: boolean;
  dismissed: boolean;
  created_at: string;
  // Joined fields
  equipment_recalls?: {
    cpsc_recall_id: string;
    recall_date: string;
    title: string;
    description: string | null;
    url: string | null;
    product_name: string | null;
    manufacturer: string | null;
    hazard: string | null;
    remedy: string | null;
  };
  equipment?: {
    id: string;
    name: string;
    make: string | null;
    model: string | null;
    category: string;
  };
}

/**
 * Fetch active (non-dismissed) recall matches for the current user.
 */
export async function getRecallMatches(): Promise<RecallMatch[]> {
  const { data, error } = await supabase
    .from('equipment_recall_matches')
    .select(`
      *,
      equipment_recalls(*),
      equipment(id, name, make, model, category)
    `)
    .eq('dismissed', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as RecallMatch[];
}

/**
 * Fetch recall matches for a specific equipment item.
 */
export async function getRecallMatchesForEquipment(equipmentId: string): Promise<RecallMatch[]> {
  const { data, error } = await supabase
    .from('equipment_recall_matches')
    .select(`
      *,
      equipment_recalls(*)
    `)
    .eq('equipment_id', equipmentId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as RecallMatch[];
}

/**
 * Dismiss a recall match (user acknowledges it's not relevant or handled).
 */
export async function dismissRecallMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('dismiss_recall_match', { p_match_id: matchId });
  if (error) throw error;
}

/**
 * Get count of active recall matches for the current user (for badge display).
 */
export async function getRecallMatchCount(): Promise<number> {
  const { count, error } = await supabase
    .from('equipment_recall_matches')
    .select('id', { count: 'exact', head: true })
    .eq('dismissed', false);

  if (error) return 0;
  return count || 0;
}
