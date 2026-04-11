// ===============================================================
// Equipment Domain
// ===============================================================
import { supabase } from './supabaseClient';
import type { Equipment } from '@/types';
import { matchAffiliateLink } from './admin';

// --- Equipment ---

export const getEquipment = async (homeId: string) => {
  const { data, error } = await supabase.from('equipment').select('*').eq('home_id', homeId).order('category');
  if (error) throw error;
  return data || [];
};

export const upsertEquipment = async (equipment: Partial<Equipment>) => {
  const { data, error } = await supabase.from('equipment').upsert(equipment).select().single();
  if (error) throw error;
  return data;
};

export const deleteEquipment = async (id: string) => {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
};

// --- Equipment Consumables (Migration 041) ---

export const getHomeConsumables = async (homeId: string) => {
  const { data, error } = await supabase
    .from('equipment_consumables')
    .select('*')
    .eq('home_id', homeId)
    .order('next_due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
};

export const getEquipmentConsumables = async (equipmentId: string) => {
  const { data, error } = await supabase
    .from('equipment_consumables')
    .select('*')
    .eq('equipment_id', equipmentId);
  if (error) throw error;
  return data || [];
};

/**
 * Bulk-replace consumables for a piece of equipment. Called after a
 * re-scan: old rows are wiped and fresh rows inserted from scanner output.
 */
export const replaceEquipmentConsumables = async (
  equipmentId: string,
  homeId: string,
  consumables: Array<{
    consumable_type: string;
    name: string;
    part_number?: string;
    spec?: string;
    quantity?: number;
    replacement_interval_months?: number;
    confidence?: number;
    notes?: string;
  }>,
) => {
  const { error: delErr } = await supabase
    .from('equipment_consumables')
    .delete()
    .eq('equipment_id', equipmentId);
  if (delErr) throw delErr;

  if (consumables.length === 0) return [];

  // Look up the parent equipment to get its category for affiliate matching
  const { data: parentEquip } = await supabase
    .from('equipment')
    .select('category')
    .eq('id', equipmentId)
    .single();
  const equipCategory = parentEquip?.category || null;

  // Auto-populate affiliate links from the curated affiliate_products table
  const rows = await Promise.all(consumables.map(async (c) => {
    const affiliateUrl = await matchAffiliateLink(c.consumable_type, c.spec, equipCategory);
    return {
      equipment_id: equipmentId,
      home_id: homeId,
      consumable_type: c.consumable_type,
      name: c.name,
      part_number: c.part_number,
      spec: c.spec,
      quantity: c.quantity ?? 1,
      replacement_interval_months: c.replacement_interval_months,
      confidence: c.confidence,
      notes: c.notes,
      detected_by: 'scan' as const,
      purchase_url: affiliateUrl,
    };
  }));

  const { data, error } = await supabase
    .from('equipment_consumables')
    .insert(rows)
    .select();
  if (error) throw error;

  // Auto-seed any new consumable type+spec combos into affiliate_products
  // so admin sees them as "needs link" in the Consumables tab
  for (const c of consumables) {
    try {
      // Check if an affiliate_products row already exists for this type+spec
      const specVal = c.spec || null;
      let query = supabase
        .from('affiliate_products')
        .select('id')
        .eq('consumable_type', c.consumable_type)
        .eq('link_type', 'consumable');
      if (specVal) {
        query = query.eq('spec_pattern', specVal);
      } else {
        query = query.is('spec_pattern', null);
      }
      const { data: existing } = await query.limit(1);
      if (!existing || existing.length === 0) {
        // Seed a placeholder row — inactive until admin adds a URL
        await supabase.from('affiliate_products').insert({
          consumable_type: c.consumable_type,
          spec_pattern: specVal,
          equipment_category: equipCategory,
          product_name: c.name + (c.spec ? ` (${c.spec})` : ''),
          affiliate_url: '',
          link_type: 'consumable',
          active: false,
          priority: 0,
          notes: `Auto-seeded from equipment scan. Part: ${c.part_number || 'unknown'}. Add Amazon affiliate URL to activate.`,
        });
      }
    } catch {
      // Non-blocking — don't fail the scan save if affiliate seeding fails
    }
  }

  return data || [];
};

export const updateConsumable = async (
  id: string,
  updates: {
    last_replaced_date?: string;
    next_due_date?: string;
    notes?: string;
    spec?: string;
    part_number?: string;
  },
) => {
  const { data, error } = await supabase
    .from('equipment_consumables')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};
