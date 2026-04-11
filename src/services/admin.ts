// ===============================================================
// admin Domain
// ===============================================================
import { supabase } from './supabaseClient';
import logger from '@/utils/logger';
import { verifyAgentOwnership } from './agents';


export const getAllAgents = async () => {
  const { data, error } = await supabase.from('agents').select('*').order('name');
  if (error) throw error;
  return data || [];
};

export const createAgentRecord = async (agent: Record<string, unknown>) => {
  const { data, error } = await supabase.from('agents').insert(agent).select().single();
  if (error) throw error;
  return data;
};

export const updateAgent = async (agentId: string, updates: Record<string, unknown>) => {
  // Security: Verify agent ownership before allowing update
  await verifyAgentOwnership(agentId);

  const { data, error } = await supabase.from('agents').update(updates).eq('id', agentId).select().single();
  if (error) throw error;
  return data;
};

export const deleteAgent = async (agentId: string) => {
  // Security: Verify agent ownership before allowing deletion
  await verifyAgentOwnership(agentId);

  const { error } = await supabase.from('agents').delete().eq('id', agentId);
  if (error) throw error;
};

export const getAllUsers = async () => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getUserDetailData = async (userId: string) => {
  // Fetch homes with equipment counts
  const { data: homes, error: homesErr } = await supabase
    .from('homes')
    .select('id, address, city, state, zip_code, year_built, square_footage, bedrooms, bathrooms')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (homesErr) throw homesErr;

  // Count equipment across all user homes
  let equipmentCount = 0;
  const homeIds = (homes || []).map(h => h.id);
  if (homeIds.length > 0) {
    const { count, error: eqErr } = await supabase
      .from('equipment')
      .select('*', { count: 'exact', head: true })
      .in('home_id', homeIds);
    if (!eqErr && count !== null) equipmentCount = count;
  }

  // Fetch agent info if user has one
  const { data: profile } = await supabase
    .from('profiles')
    .select('agent_id, gift_code, phone')
    .eq('id', userId)
    .single();

  let agent: { name: string; brokerage: string } | null = null;
  if (profile?.agent_id) {
    const { data: agentData } = await supabase
      .from('agents')
      .select('name, brokerage')
      .eq('id', profile.agent_id)
      .single();
    if (agentData) agent = agentData;
  }

  // Fetch redeemed gift code details
  let giftCodeDetails: { code: string; tier: string; agent_id: string } | null = null;
  if (profile?.gift_code) {
    const { data: codeData } = await supabase
      .from('gift_codes')
      .select('code, tier, agent_id')
      .eq('code', profile.gift_code)
      .single();
    if (codeData) giftCodeDetails = codeData;
  }

  // Count maintenance tasks and logs
  let taskCount = 0;
  let logCount = 0;
  if (homeIds.length > 0) {
    const { count: tc } = await supabase
      .from('maintenance_tasks')
      .select('*', { count: 'exact', head: true })
      .in('home_id', homeIds);
    if (tc !== null) taskCount = tc;

    const { count: lc } = await supabase
      .from('maintenance_logs')
      .select('*', { count: 'exact', head: true })
      .in('home_id', homeIds);
    if (lc !== null) logCount = lc;
  }

  return {
    homes: homes || [],
    equipmentCount,
    taskCount,
    logCount,
    phone: profile?.phone || null,
    agent,
    giftCode: profile?.gift_code || null,
    giftCodeDetails,
  };
};

export const getAllGiftCodes = async () => {
  const { data, error } = await supabase.from('gift_codes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createGiftCodes = async (codes: Record<string, unknown>[]) => {
  const { data, error } = await supabase.from('gift_codes').insert(codes).select();
  if (error) throw error;
  return data || [];
};

// --- Agent Client Functions ---

export interface ReferenceData {
  id: string;
  type: string;
  key: string;
  label: string;
  value: Record<string, any>;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const getReferenceData = async (type: string, includeInactive = false): Promise<ReferenceData[]> => {
  let query = supabase
    .from('reference_data')
    .select('*')
    .eq('type', type)
    .order('sort_order', { ascending: true });
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getAllReferenceTypes = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('reference_data')
    .select('type')
    .order('type');
  if (error) throw error;
  const types = [...new Set((data || []).map(d => d.type))];
  return types;
};

export const upsertReferenceData = async (item: Partial<ReferenceData> & { type: string; key: string; label: string }) => {
  const { data, error } = await supabase
    .from('reference_data')
    .upsert({
      ...item,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'type,key' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteReferenceData = async (id: string) => {
  const { error } = await supabase
    .from('reference_data')
    .delete()
    .eq('id', id);
  if (error) throw error;
};


export interface TaskTemplateDB {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  category: string;
  priority: string;
  frequency: string;
  applicable_months: number[];
  estimated_minutes: number | null;
  estimated_cost_low: number | null;
  estimated_cost_high: number | null;
  regions: string[];
  requires_feature: string | null;
  pro_required: boolean;
  is_weather_triggered: boolean;
  sort_order: number;
  active: boolean;
  // AI-generated template fields
  source: 'built_in' | 'ai_generated' | 'user_created';
  requires_equipment: string | null;
  requires_equipment_subtype: string[] | null;
  excludes_equipment_subtype: string[] | null;
  equipment_keyed: boolean;
  consumable_spec: string | null;
  consumable_replacement_months: number | null;
  scheduling_type: 'seasonal' | 'dynamic';
  interval_days: number | null;
  instructions_json: string[] | null;
  items_to_have_on_hand: string[] | null;
  service_purpose: string | null;
  ai_confidence: number | null;
  ai_source_equipment_id: string | null;
  created_at: string;
  updated_at: string;
}

export const getTaskTemplates = async (includeInactive = false): Promise<TaskTemplateDB[]> => {
  let query = supabase
    .from('task_templates')
    .select('*')
    .order('sort_order', { ascending: true });
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const upsertTaskTemplate = async (template: Partial<TaskTemplateDB> & { title: string; category: string }) => {
  const { data, error } = await supabase
    .from('task_templates')
    .upsert({
      ...template,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteTaskTemplate = async (id: string) => {
  const { error } = await supabase
    .from('task_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

/** Save AI-generated task templates from equipment scan (batch upsert, dedup by title+category) */
export const saveAIGeneratedTemplates = async (
  templates: Array<{
    title: string;
    description: string;
    instructions?: string[];
    category: string;
    priority?: string;
    frequency?: string;
    applicable_months?: number[];
    estimated_minutes?: number;
    estimated_cost_low?: number;
    estimated_cost_high?: number;
    requires_equipment?: string;
    scheduling_type?: 'seasonal' | 'dynamic';
    interval_days?: number;
    items_to_have_on_hand?: string[];
    service_purpose?: string;
    ai_confidence?: number;
    ai_source_equipment_id?: string;
  }>
): Promise<TaskTemplateDB[]> => {
  if (templates.length === 0) return [];

  const rows = templates.map((t) => ({
    title: t.title,
    description: t.description,
    instructions_json: t.instructions ?? null,
    category: t.category,
    priority: t.priority ?? 'medium',
    frequency: t.frequency ?? 'annual',
    applicable_months: t.applicable_months ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    estimated_minutes: t.estimated_minutes ?? 30,
    estimated_cost_low: t.estimated_cost_low ?? null,
    estimated_cost_high: t.estimated_cost_high ?? null,
    requires_equipment: t.requires_equipment ?? null,
    scheduling_type: t.scheduling_type ?? 'seasonal',
    interval_days: t.interval_days ?? null,
    items_to_have_on_hand: t.items_to_have_on_hand ?? null,
    service_purpose: t.service_purpose ?? null,
    source: 'ai_generated' as const,
    ai_confidence: t.ai_confidence ?? null,
    ai_source_equipment_id: t.ai_source_equipment_id ?? null,
    active: true,
    updated_at: new Date().toISOString(),
  }));

  // Check for existing templates with same title+category to avoid duplicates
  const titles = rows.map((r) => r.title);
  const { data: existing } = await supabase
    .from('task_templates')
    .select('title, category')
    .in('title', titles);
  const existingKeys = new Set((existing || []).map((e: { title: string; category: string }) => `${e.title}|${e.category}`));
  const newRows = rows.filter((r) => !existingKeys.has(`${r.title}|${r.category}`));
  if (newRows.length === 0) return [];

  const { data, error } = await supabase
    .from('task_templates')
    .insert(newRows)
    .select();
  if (error) throw error;
  return data || [];
};


export interface AffiliateProduct {
  id: string;
  consumable_type: string;
  spec_pattern: string | null;
  product_name: string;
  affiliate_url: string;
  equipment_category: string | null;
  priority: number;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  item_key: string | null;
  quality_tier: 'budget' | 'recommended' | 'premium' | null;
  price_estimate: number | null;
  link_type: 'consumable' | 'item_on_hand';
}

/** Fetch all affiliate products (admin view — includes inactive) */
export const getAffiliateProducts = async (activeOnly = false): Promise<AffiliateProduct[]> => {
  let query = supabase
    .from('affiliate_products')
    .select('*')
    .order('consumable_type')
    .order('priority', { ascending: false });
  if (activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/** Create or update an affiliate product */
export const upsertAffiliateProduct = async (product: Partial<AffiliateProduct> & { product_name: string; affiliate_url: string }): Promise<AffiliateProduct> => {
  const { data, error } = await supabase
    .from('affiliate_products')
    .upsert(product)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Delete an affiliate product */
export const deleteAffiliateProduct = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('affiliate_products')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

/**
 * Look up the best affiliate link for a given consumable type + spec.
 * Priority order: exact spec match > fallback (null spec) > no match.
 */
export const matchAffiliateLink = async (
  consumableType: string,
  spec?: string | null,
  equipmentCategory?: string | null,
): Promise<string | null> => {
  // Fetch all active matches for this consumable type, ordered by priority
  let query = supabase
    .from('affiliate_products')
    .select('affiliate_url, spec_pattern, equipment_category')
    .eq('consumable_type', consumableType)
    .eq('active', true)
    .order('priority', { ascending: false });

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  // Prefer: exact spec + equipment match > exact spec > equipment match > generic fallback
  const exactSpecAndEquip = data.find((p) => p.spec_pattern === spec && p.equipment_category === equipmentCategory);
  if (exactSpecAndEquip) return exactSpecAndEquip.affiliate_url;

  const exactSpec = data.find((p) => p.spec_pattern === spec);
  if (exactSpec) return exactSpec.affiliate_url;

  const equipMatch = data.find((p) => !p.spec_pattern && p.equipment_category === equipmentCategory);
  if (equipMatch) return equipMatch.affiliate_url;

  const fallback = data.find((p) => !p.spec_pattern && !p.equipment_category);
  if (fallback) return fallback.affiliate_url;

  return data[0]?.affiliate_url || null;
};

/**
 * Look up affiliate products for an items_to_have_on_hand string.
 * Returns multiple products (different quality tiers) sorted by priority.
 * Matches by normalized item_key (lowercased, trimmed).
 */
export const matchAffiliateLinksForItem = async (
  itemName: string,
): Promise<AffiliateProduct[]> => {
  const key = itemName.toLowerCase().trim();
  const { data, error } = await supabase
    .from('affiliate_products')
    .select('*')
    .eq('link_type', 'item_on_hand')
    .eq('item_key', key)
    .eq('active', true)
    .order('priority', { ascending: false });

  if (error || !data) return [];
  return data as AffiliateProduct[];
};

/**
 * Batch-fetch affiliate links for multiple items_to_have_on_hand at once.
 * Returns a map of item_key → AffiliateProduct[].
 * Much more efficient than calling matchAffiliateLinksForItem per item.
 */
export const batchMatchAffiliateLinksForItems = async (
  itemNames: string[],
): Promise<Record<string, AffiliateProduct[]>> => {
  if (!itemNames.length) return {};
  const keys = itemNames.map((n) => n.toLowerCase().trim());
  const { data, error } = await supabase
    .from('affiliate_products')
    .select('*')
    .eq('link_type', 'item_on_hand')
    .in('item_key', keys)
    .eq('active', true)
    .order('priority', { ascending: false });

  if (error || !data) return {};

  const result: Record<string, AffiliateProduct[]> = {};
  for (const product of data as AffiliateProduct[]) {
    const k = product.item_key || '';
    if (!result[k]) result[k] = [];
    result[k].push(product);
  }
  return result;
};

// ─── Service Area Services ───
