import { supabase } from './supabaseClient';
import type { Warranty } from '@/types';

/**
 * Get all warranties for a home (both home-level and equipment-level)
 */
export async function getWarrantiesForHome(homeId: string): Promise<Warranty[]> {
  const { data, error } = await supabase
    .from('warranties')
    .select('*')
    .eq('home_id', homeId)
    .order('end_date', { ascending: true });

  if (error) throw error;
  return (data || []) as Warranty[];
}

/**
 * Get all warranties tied to a specific equipment
 */
export async function getWarrantiesForEquipment(equipmentId: string): Promise<Warranty[]> {
  const { data, error } = await supabase
    .from('warranties')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('end_date', { ascending: true });

  if (error) throw error;
  return (data || []) as Warranty[];
}

/**
 * Get warranties expiring within N days (for dashboard banner).
 *
 * 2026-04-29: must query `warranties_with_expiry` (a view), not the
 * `warranties` base table, because `days_until_expiry` is a computed
 * column that only exists on the view. The base table has `end_date`
 * but no derived column. Mobile parity: `Canopy-App/services/supabase.ts`
 * has always queried the view; web was the broken side. Before this
 * fix, the dashboard expiring-warranty banner never appeared on web.
 *
 * Writes (upsert/delete/updateStatus below) still target the base
 * `warranties` table — the view is read-only.
 */
export async function getExpiringWarranties(homeId: string, daysWindow: number = 60): Promise<Warranty[]> {
  const { data, error } = await supabase
    .from('warranties_with_expiry')
    .select('*')
    .eq('home_id', homeId)
    .eq('status', 'active')
    .lte('days_until_expiry', daysWindow)
    .gte('days_until_expiry', 0)
    .order('end_date', { ascending: true });

  if (error) throw error;
  return (data || []) as Warranty[];
}

/**
 * Create or update a warranty
 */
export async function upsertWarranty(warranty: Warranty): Promise<Warranty> {
  const { data, error } = await supabase
    .from('warranties')
    .upsert([warranty], { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data as Warranty;
}

/**
 * Delete a warranty by id
 */
export async function deleteWarranty(warrantyId: string): Promise<void> {
  const { error } = await supabase
    .from('warranties')
    .delete()
    .eq('id', warrantyId);

  if (error) throw error;
}

/**
 * Update warranty status (e.g., mark as claimed, expired, cancelled)
 */
export async function updateWarrantyStatus(
  warrantyId: string,
  status: 'active' | 'expired' | 'claimed' | 'cancelled' | 'transferred'
): Promise<void> {
  const { error } = await supabase
    .from('warranties')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', warrantyId);

  if (error) throw error;
}

/**
 * Get a single warranty by ID
 */
export async function getWarranty(warrantyId: string): Promise<Warranty> {
  const { data, error } = await supabase
    .from('warranties')
    .select('*')
    .eq('id', warrantyId)
    .single();

  if (error) throw error;
  return data as Warranty;
}
