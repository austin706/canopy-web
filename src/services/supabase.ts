// ===============================================================
// Canopy Web — Supabase Client & API (web version)
// ===============================================================
import { createClient } from '@supabase/supabase-js';
import type { Home, Equipment, MaintenanceTask, MaintenanceLog, ProProvider } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Guard against missing environment variables
if (!SUPABASE_URL) {
  console.error('VITE_SUPABASE_URL is not configured — Supabase client will not function');
}
if (!SUPABASE_ANON_KEY) {
  console.error('VITE_SUPABASE_ANON_KEY is not configured — Supabase client will not function');
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

// --- Auth ---
export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/login?verified=true`,
    },
  });
  if (error) throw error;

  // Send welcome/verification email via our Resend-backed notification system.
  // Supabase Auth's built-in confirmation email may be disabled, so we send our own
  // to make sure the user always gets a welcome email regardless of auth config.
  if (data.user?.id) {
    sendDirectEmailNotification({
      recipient_email: email,
      user_id: data.user.id,
      title: `Welcome to Canopy, ${fullName}!`,
      body: `Thanks for creating your Canopy account! Sign in to set up your home profile, scan your equipment, and get personalized maintenance reminders.\n\nYour next step: Complete the onboarding walkthrough to unlock your dashboard.`,
      subject: `Welcome to Canopy, ${fullName}!`,
      category: 'onboarding',
      action_url: '/onboarding',
      action_label: 'Get Started',
    }).catch(() => {}); // Non-blocking
  }

  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
};

export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const resendVerificationEmail = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('No user email found');
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: user.email,
    options: {
      emailRedirectTo: `${window.location.origin}/login?verified=true`,
    },
  });
  if (error) throw error;
};

// --- Home Profile ---
export const getHome = async (userId: string) => {
  const { data, error } = await supabase.from('homes').select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// createHome is deprecated — use upsertHome instead
// export const createHome = async (home: any) => { ... };

export const upsertHome = async (home: Partial<Home>) => {
  const { data, error } = await supabase.from('homes').upsert(home).select().single();
  if (error) throw error;
  return data;
};

// --- Multi-Property Support ---

/** Get all homes for a user */
export const getUserHomes = async (userId: string) => {
  const { data, error } = await supabase
    .from('homes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

/** Check if an address is already claimed by another user */
export const checkAddressClaimed = async (
  address: string,
  city: string,
  state: string,
  zipCode: string,
  excludeUserId?: string
): Promise<{ claimed: boolean; homeId?: string; ownerId?: string }> => {
  let query = supabase
    .from('homes')
    .select('id, user_id')
    .ilike('address', address.trim())
    .ilike('city', city.trim())
    .ilike('state', state.trim())
    .eq('zip_code', zipCode.trim());

  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;

  if (data && data.length > 0) {
    return { claimed: true, homeId: data[0].id, ownerId: data[0].user_id };
  }
  return { claimed: false };
};

/** Request to join an existing home */
export const createHomeJoinRequest = async (
  homeId: string,
  requesterId: string,
  ownerId: string,
  message?: string
) => {
  const { data, error } = await supabase
    .from('home_join_requests')
    .insert({
      home_id: homeId,
      requester_id: requesterId,
      owner_id: ownerId,
      message: message || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Get pending join requests for a home owner */
export const getHomeJoinRequests = async (ownerId: string) => {
  const { data, error } = await supabase
    .from('home_join_requests')
    .select('*, homes(address, city, state), requester:profiles!home_join_requests_requester_id_fkey(full_name, email)')
    .eq('owner_id', ownerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

/** Approve a join request — adds the requester as a home_member on the canonical home
 *  (NO cloning — google_place_id is unique per physical property, so the requester
 *   shares the single canonical home record via home_members). */
export const approveHomeJoinRequest = async (requestId: string) => {
  // Get the request details
  const { data: request, error: reqErr } = await supabase
    .from('home_join_requests')
    .select('id, home_id, requester_id, owner_id')
    .eq('id', requestId)
    .single();
  if (reqErr || !request) throw reqErr || new Error('Request not found');

  // Add requester as accepted home_member (upsert handles re-approval after a decline)
  const { error: memberErr } = await supabase
    .from('home_members')
    .upsert(
      {
        home_id: request.home_id,
        user_id: request.requester_id,
        role: 'editor',
        invite_status: 'accepted',
        invited_by: request.owner_id,
      },
      { onConflict: 'home_id,user_id' },
    );
  if (memberErr) throw memberErr;

  // Mark request as approved
  const { error: updErr } = await supabase
    .from('home_join_requests')
    .update({ status: 'approved', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (updErr) throw updErr;

  return { home_id: request.home_id, user_id: request.requester_id };
};

/** Deny a join request */
export const denyHomeJoinRequest = async (requestId: string) => {
  const { error } = await supabase
    .from('home_join_requests')
    .update({ status: 'denied', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
};

// --- Additional Structures ---

export const STRUCTURE_TYPES = {
  guest_house: 'Guest House',
  detached_garage: 'Detached Garage',
  workshop: 'Workshop',
  adu: 'ADU / In-Law Suite',
  barn: 'Barn / Outbuilding',
  pool_house: 'Pool House',
  shed: 'Shed',
  other: 'Other',
} as const;

export type StructureType = keyof typeof STRUCTURE_TYPES;

/** Get all structures (child homes) for a parent home */
export const getStructures = async (parentHomeId: string): Promise<Home[]> => {
  const { data, error } = await supabase
    .from('homes')
    .select('*')
    .eq('parent_home_id', parentHomeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

/** Add a new structure to a home */
export const addStructure = async (
  parentHomeId: string,
  structureType: StructureType,
  label: string
): Promise<Home> => {
  // Fetch parent home to copy address details
  const { data: parentHome, error: parentErr } = await supabase
    .from('homes')
    .select('*')
    .eq('id', parentHomeId)
    .single();
  if (parentErr || !parentHome) throw parentErr || new Error('Parent home not found');

  // Create new structure record with parent's address and location data
  const newStructure: Partial<Home> = {
    user_id: parentHome.user_id,
    address: parentHome.address,
    city: parentHome.city,
    state: parentHome.state,
    zip_code: parentHome.zip_code,
    latitude: parentHome.latitude,
    longitude: parentHome.longitude,
    parent_home_id: parentHomeId,
    structure_type: structureType,
    structure_label: label,
    // Initialize default values
    stories: 1,
    bedrooms: 0,
    bathrooms: 0,
    garage_spaces: 0,
    has_pool: false,
    has_deck: false,
    has_sprinkler_system: false,
    has_fireplace: false,
    created_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('homes')
    .insert(newStructure)
    .select()
    .single();
  if (error) throw error;
  return created;
};

/** Delete a structure (child home) */
export const deleteStructure = async (structureId: string): Promise<void> => {
  const { error } = await supabase.from('homes').delete().eq('id', structureId);
  if (error) throw error;
};

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

// --- Calendar token / iCal subscribe ---

/**
 * Fetch the user's current calendar subscription token. Returns null if
 * none has been issued yet. The token is the sole credential for the
 * public `ical-feed` edge function, so treat it like a password.
 */
export const getCalendarToken = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('calendar_token')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return (data as { calendar_token: string | null } | null)?.calendar_token ?? null;
};

/**
 * Generate a new calendar token and persist it to the user's profile.
 * Rotating the token invalidates any previously subscribed calendar URLs.
 * Uses the `generate_calendar_token` Postgres RPC defined in migration 042.
 */
export const rotateCalendarToken = async (userId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('generate_calendar_token');
  if (error) throw error;
  const token = data as string;
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ calendar_token: token })
    .eq('id', userId);
  if (updateErr) throw updateErr;
  return token;
};

/**
 * Build the public webcal/https subscription URL for the ical-feed edge
 * function. Calendar apps (Apple Calendar, Google Calendar, Outlook)
 * accept https:// for one-time import or webcal:// for live subscription.
 */
export const buildICalSubscribeUrl = (token: string): string => {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  return `${base}/functions/v1/ical-feed?token=${encodeURIComponent(token)}`;
};

// --- Tasks ---
export const getTasks = async (homeId: string) => {
  const { data, error } = await supabase.from('maintenance_tasks').select('*').eq('home_id', homeId).is('deleted_at', null).order('due_date');
  if (error) throw error;
  return data || [];
};

export const completeTask = async (taskId: string, notes?: string, photoUrl?: string) => {
  const { data, error } = await supabase.from('maintenance_tasks')
    .update({ status: 'completed', completed_date: new Date().toISOString(), completion_notes: notes, completion_photo_url: photoUrl })
    .eq('id', taskId).select().single();
  if (error) throw error;
  return data;
};

export const reopenTask = async (taskId: string) => {
  const { data, error } = await supabase.from('maintenance_tasks')
    .update({ status: 'upcoming', completed_date: null, completion_notes: null, completion_photo_url: null })
    .eq('id', taskId).select().single();
  if (error) throw error;
  return data;
};

export const createTask = async (task: Partial<MaintenanceTask>) => {
  const { data, error } = await supabase.from('maintenance_tasks').insert(task).select().single();
  if (error) throw error;
  return data;
};

export const createTasks = async (tasks: Partial<MaintenanceTask>[]) => {
  const { data, error } = await supabase.from('maintenance_tasks').insert(tasks).select();
  if (error) throw error;
  return data || [];
};

export const deleteTask = async (taskId: string) => {
  const { error } = await supabase.from('maintenance_tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
};

// --- Maintenance Log ---
export const getMaintenanceLogs = async (homeId: string) => {
  const { data, error } = await supabase.from('maintenance_logs').select('*').eq('home_id', homeId).order('completed_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const addMaintenanceLog = async (log: Partial<MaintenanceLog>) => {
  const { data, error } = await supabase.from('maintenance_logs').insert(log).select().single();
  if (error) throw error;
  return data;
};

export const updateMaintenanceLog = async (logId: string, updates: Record<string, unknown>) => {
  const { data, error } = await supabase.from('maintenance_logs').update(updates).eq('id', logId).select().single();
  if (error) throw error;
  return data;
};

// --- Photo Upload ---
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const uploadPhoto = async (bucket: string, path: string, file: File) => {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is 20MB.`);
  }

  // Validate MIME type
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`File type "${file.type}" is not allowed. Accepted: JPEG, PNG, HEIC, WebP, PDF.`);
  }

  const { data, error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
};

// --- Profile Management ---
export const updateProfile = async (userId: string, updates: Record<string, unknown>) => {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
  if (error) throw error;
  return data;
};

export const getProfile = async (userId: string) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
};

// --- Agent Linking ---
export const lookupAgentByCode = async (code: string) => {
  // Agents share a simple code (e.g., their email or a short code) for homeowners to link
  const trimmed = code.trim().toLowerCase();
  // Try lookup by email first, then by id
  const { data: byEmail } = await supabase.from('agents').select('*').eq('email', trimmed).single();
  if (byEmail) return byEmail;
  const { data: byId } = await supabase.from('agents').select('*').eq('id', trimmed).single();
  if (byId) return byId;
  throw new Error('Agent not found. Check the code and try again.');
};

export const linkAgent = async (userId: string, agentId: string) => {
  const { error } = await supabase.from('profiles').update({ agent_id: agentId }).eq('id', userId);
  if (error) throw error;
};

// --- Gift Codes ---
export const redeemGiftCode = async (code: string, userId: string) => {
  const { data: gc, error: lookupErr } = await supabase.from('gift_codes').select('*').eq('code', code.trim().toUpperCase()).single();
  if (lookupErr || !gc) throw new Error('Invalid code');
  if (gc.redeemed_by) throw new Error('Code already redeemed');
  if (gc.expires_at && new Date(gc.expires_at) < new Date()) throw new Error('Code expired');

  const newExpiry = new Date();
  newExpiry.setMonth(newExpiry.getMonth() + (gc.duration_months || 12));
  await supabase.from('gift_codes').update({ redeemed_by: userId, redeemed_at: new Date().toISOString() }).eq('id', gc.id);
  const profileUpdate: Record<string, unknown> = { subscription_tier: gc.tier, subscription_expires_at: newExpiry.toISOString(), agent_id: gc.agent_id };
  if (gc.client_name) profileUpdate.full_name = gc.client_name;
  await supabase.from('profiles').update(profileUpdate).eq('id', userId);

  // If the gift code has a pending home (pre-configured by agent), create it for the user
  if (gc.pending_home && typeof gc.pending_home === 'object') {
    const homeData = {
      id: crypto.randomUUID(),
      user_id: userId,
      ...gc.pending_home,
      created_at: new Date().toISOString(),
    };
    await supabase.from('homes').upsert(homeData);
    // Mark onboarding as complete since home is set up
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId);
  }

  let agent = null;
  if (gc.agent_id) {
    const { data } = await supabase.from('agents').select('*').eq('id', gc.agent_id).single();
    agent = data;
  }
  return { success: true, tier: gc.tier, expiresAt: newExpiry.toISOString(), agent };
};

export const getAgent = async (agentId: string) => {
  const { data, error } = await supabase.from('agents').select('*').eq('id', agentId).single();
  if (error) throw error;
  return data;
};

// --- Pro Requests ---
export const createProRequest = async (request: Record<string, unknown>) => {
  const { data, error } = await supabase.from('pro_requests').insert(request).select().single();
  if (error) throw error;

  // Auto-match to a provider (fire-and-forget — doesn't block request creation)
  try {
    await supabase.functions.invoke('match-provider', {
      body: { request_id: data.id },
    });
  } catch (matchErr) {
    console.error('Auto-match provider error (non-blocking):', matchErr);
  }

  return data;
};

export const getProRequests = async (userId: string) => {
  const { data, error } = await supabase.from('pro_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getAllProRequests = async () => {
  const { data, error } = await supabase.from('pro_requests').select('*, user:user_id(id, email, full_name)').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const updateProRequest = async (id: string, updates: Record<string, unknown>) => {
  const { data, error } = await supabase.from('pro_requests').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const getAllProProviders = async () => {
  const { data, error } = await supabase.from('pro_providers').select('*').order('business_name');
  if (error) throw error;
  return data || [];
};

export const createProProvider = async (provider: Partial<ProProvider>) => {
  const { data, error } = await supabase.from('pro_providers').insert(provider).select().single();
  if (error) throw error;
  return data;
};

export const updateProProvider = async (id: string, updates: Partial<ProProvider>) => {
  const { data, error } = await supabase.from('pro_providers').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteProProvider = async (id: string) => {
  const { error } = await supabase.from('pro_providers').delete().eq('id', id);
  if (error) throw error;
};

// --- Admin Functions ---
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
  const { data, error } = await supabase.from('agents').update(updates).eq('id', agentId).select().single();
  if (error) throw error;
  return data;
};

export const deleteAgent = async (agentId: string) => {
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
export const getClientHome = async (clientUserId: string) => {
  const { data, error } = await supabase.from('homes').select('*').eq('user_id', clientUserId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// getClientEquipment and getClientTasks are unused — use getEquipment/getTasks instead
// export const getClientEquipment = async (homeId: string) => { ... };
// export const getClientTasks = async (homeId: string) => { ... };

export const upsertClientHome = async (home: Partial<Home>) => {
  const { data, error } = await supabase.from('homes').upsert(home).select().single();
  if (error) throw error;
  return data;
};

// --- Pro Interest Waitlist ---
export const insertProInterest = async (interest: {
  email: string;
  zip_code?: string | null;
  user_id?: string | null;
  state?: string | null;
  city?: string | null;
  full_name?: string | null;
  tier_interest?: 'pro' | 'pro_plus';
}) => {
  const { data, error } = await supabase
    .from('pro_interest')
    .upsert(interest, { onConflict: 'user_id,tier_interest' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// --- Account Deletion ---
export const deleteUserAccount = async (userId: string) => {
  const { error } = await supabase.rpc('delete_user_and_data', { target_user_id: userId });
  if (error) throw error;
};

// --- GDPR/CCPA Data Export ---
// Returns a JSONB blob of everything Canopy stores about the user across ~17 tables.
// Callable by the user themselves (via auth.uid() check in the RPC) or an admin.
export const exportUserData = async (userId: string): Promise<Record<string, unknown>> => {
  const { data, error } = await supabase.rpc('export_user_data', { target_user_id: userId });
  if (error) throw error;
  return (data as Record<string, unknown>) || {};
};

// --- Notifications Feed ---
export const getNotifications = async (userId: string, limit = 50) => {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
};

// getUnreadNotificationCount is unused — notification badge uses getNotifications().filter(n => !n.read)
// export const getUnreadNotificationCount = async (userId: string) => { ... };

export const markNotificationRead = async (id: string) => {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
};

export const markAllNotificationsRead = async (userId: string) => {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
};

/**
 * Save a notification to the database.
 *
 * Email and push delivery are handled server-side by a pg_cron job that calls
 * send-notifications?mode=process-queue every 2 minutes. This decouples the
 * fast in-app save (done here) from the slower email/push delivery, which
 * must happen server-to-server (the browser→edge function POST path is broken
 * by a CORS issue where the POST never reaches the function after preflight).
 *
 * The process-queue picks up rows with pushed=false OR emailed=false, sends
 * the email/push, and marks them delivered.
 */
export const sendNotification = async (params: {
  user_id: string;
  title: string;
  body: string;
  category?: string;
  action_url?: string;
  data?: Record<string, unknown>;
}): Promise<{ saved: boolean }> => {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.user_id,
    title: params.title,
    body: params.body,
    category: params.category || 'general',
    action_url: params.action_url || null,
    data: params.data || null,
    read: false,
    pushed: false,
    emailed: false,
  });
  if (error) {
    console.error('sendNotification insert failed:', error);
    return { saved: false };
  }
  return { saved: true };
};

/**
 * Queue an email-only notification for a recipient who may not have a Canopy account.
 * Used for agents without accounts, external parties, etc.
 * The process-queue cron will pick this up and send via Resend.
 * If the recipient also has a Canopy account, pass their user_id to also create an in-app notification.
 */
export const sendDirectEmailNotification = async (params: {
  recipient_email: string;
  title: string;
  body: string;
  subject?: string;
  category?: string;
  action_url?: string;
  action_label?: string;
  user_id?: string; // optional: also saves in-app notification if they have an account
}): Promise<{ saved: boolean }> => {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.user_id || null,
    recipient_email: params.recipient_email,
    title: params.title,
    body: params.body,
    category: params.category || 'general',
    action_url: params.action_url || null,
    data: params.action_label ? { action_label: params.action_label, subject: params.subject } : null,
    read: false,
    pushed: false,
    emailed: false,
    // Mark this row as ready for the retry worker to pick up on its next
    // tick. If the inline sender succeeds first and flips `emailed=true`,
    // the worker's partial index will drop the row from consideration.
    email_next_retry_at: new Date().toISOString(),
  });
  if (error) {
    console.error('sendDirectEmailNotification insert failed:', error);
    return { saved: false };
  }
  return { saved: true };
};

// --- Notification Preferences ---
export const getNotificationPreferences = async (userId: string) => {
  const { data, error } = await supabase.from('profiles').select('notification_preferences').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.notification_preferences || null;
};

export const updateNotificationPreferences = async (userId: string, preferences: Record<string, unknown>) => {
  const { data, error } = await supabase.from('profiles')
    .update({ notification_preferences: preferences })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// --- Documents ---
export const getDocuments = async (homeId: string) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('home_id', homeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createDocument = async (doc: {
  home_id: string;
  user_id: string;
  title: string;
  category: string;
  file_url: string;
  thumbnail_url?: string;
}) => {
  const { data, error } = await supabase
    .from('documents')
    .insert(doc)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteDocument = async (id: string) => {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
};

// --- Secure Notes ---
export const getSecureNotes = async (homeId: string) => {
  const { data, error } = await supabase
    .from('secure_notes')
    .select('*')
    .eq('home_id', homeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createSecureNote = async (note: {
  home_id: string;
  title: string;
  content: string;
  category: string;
}) => {
  const { data, error } = await supabase
    .from('secure_notes')
    .insert(note)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteSecureNote = async (id: string) => {
  const { error } = await supabase.from('secure_notes').delete().eq('id', id);
  if (error) throw error;
};

// --- Vault PIN ---
export const getVaultPin = async (userId: string) => {
  const { data, error } = await supabase
    .from('vault_pins')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const upsertVaultPin = async (userId: string, pinHash: string) => {
  const { data, error } = await supabase
    .from('vault_pins')
    .upsert({
      user_id: userId,
      pin_hash: pinHash,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── Home Members ───

export interface HomeMember {
  id: string;
  home_id: string;
  user_id: string | null;
  role: 'owner' | 'editor' | 'viewer';
  invite_email: string | null;
  invite_status: 'pending' | 'accepted' | 'declined';
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  profile?: { full_name: string; email: string } | null;
}

export const getHomeMembers = async (homeId: string): Promise<HomeMember[]> => {
  const { data, error } = await supabase
    .from('home_members')
    .select('*, profile:profiles!home_members_user_id_fkey(full_name, email)')
    .eq('home_id', homeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as HomeMember[];
};

export const inviteHomeMember = async (homeId: string, email: string, role: 'editor' | 'viewer', invitedBy: string) => {
  // Check if there's already a user with this email
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email.toLowerCase().trim())
    .single();

  const insertData: Record<string, any> = {
    home_id: homeId,
    role,
    invite_email: email.toLowerCase().trim(),
    invited_by: invitedBy,
    invite_status: existingProfile ? 'pending' : 'pending',
    user_id: existingProfile?.id || null,
  };

  const { data, error } = await supabase
    .from('home_members')
    .insert([insertData])
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('This person has already been invited to this home.');
    throw error;
  }

  // Send invite notification email
  try {
    await supabase.functions.invoke('send-email', {
      body: {
        to: email,
        subject: 'You\'ve been invited to join a home on Canopy',
        html: `
          <h2>You've been invited!</h2>
          <p>Someone has invited you to join their home on Canopy Home.</p>
          <p><strong>Role:</strong> ${role === 'editor' ? 'Editor (can view and edit)' : 'Viewer (can view only)'}</p>
          <p>${existingProfile ? 'Log in to your Canopy account to accept this invitation.' : 'Create a Canopy account with this email to accept.'}</p>
          <p><a href="https://canopyhome.app">Open Canopy</a></p>
        `,
      },
    });
  } catch (emailErr) {
    console.error('Invite email failed:', emailErr);
  }

  return data;
};

export const acceptHomeInvite = async (memberId: string) => {
  const { data, error } = await supabase
    .from('home_members')
    .update({ invite_status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const declineHomeInvite = async (memberId: string) => {
  const { data, error } = await supabase
    .from('home_members')
    .update({ invite_status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const removeHomeMember = async (memberId: string) => {
  const { error } = await supabase
    .from('home_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
};

export const updateHomeMemberRole = async (memberId: string, role: 'editor' | 'viewer') => {
  const { data, error } = await supabase
    .from('home_members')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getPendingInvites = async (userEmail: string) => {
  const { data, error } = await supabase
    .from('home_members')
    .select('*, home:homes!home_members_home_id_fkey(address, city, state)')
    .eq('invite_email', userEmail.toLowerCase())
    .eq('invite_status', 'pending');
  if (error) throw error;
  return data || [];
};

export const getMyMemberships = async (userId: string) => {
  const { data, error } = await supabase
    .from('home_members')
    .select('*, home:homes!home_members_home_id_fkey(id, address, city, state, zip_code)')
    .eq('user_id', userId)
    .eq('invite_status', 'accepted');
  if (error) throw error;
  return data || [];
};

// ─── Reference Data ───

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

// ─── Task Templates (DB) ───

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

// ─── Affiliate Products ───

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

export interface ServiceAreaService {
  id: string;
  service_area_id: string;
  service_key: string;
  service_label: string;
  category: string;
  is_active: boolean;
  base_price_cents: number | null;
  estimated_minutes: number | null;
  requires_pro_plus: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const getServiceAreaServices = async (serviceAreaId: string, includeInactive = false): Promise<ServiceAreaService[]> => {
  let query = supabase
    .from('service_area_services')
    .select('*')
    .eq('service_area_id', serviceAreaId)
    .order('sort_order', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const upsertServiceAreaService = async (item: Partial<ServiceAreaService> & { service_area_id: string; service_key: string; service_label: string; category: string }) => {
  const { data, error } = await supabase
    .from('service_area_services')
    .upsert({
      ...item,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'service_area_id,service_key' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteServiceAreaService = async (id: string) => {
  const { error } = await supabase
    .from('service_area_services')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ─── Provider Services (Capabilities) ───

export interface ProviderService {
  id: string;
  provider_id: string;
  service_key: string;
  proficiency: 'basic' | 'standard' | 'expert';
  is_active: boolean;
  certified_at: string | null;
  notes: string | null;
  created_at: string;
}

export const getProviderServices = async (providerId: string): Promise<ProviderService[]> => {
  const { data, error } = await supabase
    .from('provider_services')
    .select('*')
    .eq('provider_id', providerId)
    .eq('is_active', true);
  if (error) throw error;
  return data || [];
};

export const upsertProviderService = async (item: Partial<ProviderService> & { provider_id: string; service_key: string }) => {
  const { data, error } = await supabase
    .from('provider_services')
    .upsert(item, { onConflict: 'provider_id,service_key' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteProviderService = async (id: string) => {
  const { error } = await supabase
    .from('provider_services')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ─── Technician Onboarding ───

export interface TrainingMaterial {
  id: string;
  title: string;
  description: string | null;
  category: string;
  content_type: string;
  content_url: string | null;
  content_body: string | null;
  duration_minutes: number | null;
  required_for_level: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string | null;
  category: string;
  required: boolean;
  sort_order: number;
  estimated_minutes: number | null;
  training_material_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TechnicianOnboarding {
  id: string;
  provider_id: string;
  step_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  score: number | null;
  created_at: string;
  updated_at: string;
  step?: OnboardingStep;
}

export const getTrainingMaterials = async (category?: string): Promise<TrainingMaterial[]> => {
  let query = supabase
    .from('training_materials')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const upsertTrainingMaterial = async (item: Partial<TrainingMaterial> & { title: string; category: string; content_type: string }) => {
  const { data, error } = await supabase
    .from('training_materials')
    .upsert({ ...item, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getOnboardingSteps = async (): Promise<OnboardingStep[]> => {
  const { data, error } = await supabase
    .from('onboarding_steps')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getTechnicianOnboardingProgress = async (providerId: string): Promise<TechnicianOnboarding[]> => {
  const { data, error } = await supabase
    .from('technician_onboarding')
    .select('*, step:onboarding_steps(*)')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const initTechnicianOnboarding = async (providerId: string): Promise<void> => {
  const steps = await getOnboardingSteps();
  const records = steps.map(step => ({
    provider_id: providerId,
    step_id: step.id,
    status: 'pending' as const,
  }));
  if (records.length > 0) {
    const { error } = await supabase
      .from('technician_onboarding')
      .upsert(records, { onConflict: 'provider_id,step_id' });
    if (error) throw error;
  }
};

// ─── Equipment Scan Guides ───

export interface EquipmentScanGuide {
  id: string;
  equipment_type: string;
  display_name: string;
  icon: string | null;
  category: string;
  nameplate_location: string;
  nameplate_description: string | null;
  photo_url: string | null;
  video_url: string | null;
  tips: string[];
  common_brands: string[];
  every_home_should_have: boolean;
  priority_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentChecklist {
  id: string;
  user_id: string;
  home_id: string;
  equipment_type: string;
  status: 'not_started' | 'scanned' | 'not_applicable' | 'skipped';
  equipment_id: string | null;
  created_at: string;
  updated_at: string;
}

export const getEquipmentScanGuides = async (): Promise<EquipmentScanGuide[]> => {
  const { data, error } = await supabase
    .from('equipment_scan_guides')
    .select('*')
    .eq('is_active', true)
    .order('priority_order', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getEssentialEquipmentGuides = async (): Promise<EquipmentScanGuide[]> => {
  const { data, error } = await supabase
    .from('equipment_scan_guides')
    .select('*')
    .eq('is_active', true)
    .eq('every_home_should_have', true)
    .order('priority_order', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getEquipmentChecklist = async (homeId: string): Promise<EquipmentChecklist[]> => {
  const { data, error } = await supabase
    .from('equipment_checklist')
    .select('*')
    .eq('home_id', homeId);
  if (error) throw error;
  return data || [];
};

export const upsertEquipmentChecklist = async (item: { user_id: string; home_id: string; equipment_type: string; status: string; equipment_id?: string }) => {
  const { data, error } = await supabase
    .from('equipment_checklist')
    .upsert({
      ...item,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'home_id,equipment_type' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateOnboardingStepStatus = async (
  providerId: string,
  stepId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'skipped',
  notes?: string,
  score?: number
) => {
  const update: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'completed') {
    update.completed_at = new Date().toISOString();
  }
  if (notes !== undefined) update.notes = notes;
  if (score !== undefined) update.score = score;

  const { data, error } = await supabase
    .from('technician_onboarding')
    .update(update)
    .eq('provider_id', providerId)
    .eq('step_id', stepId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── Agent QR Codes ───

export interface AgentHomeQRCode {
  id: string;
  agent_id: string;
  home_id: string | null;
  qr_token: string;
  gift_code_id: string | null;
  status: 'active' | 'claimed' | 'expired' | 'revoked';
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  notes: string | null;
  home_data: Record<string, unknown> | null;
  buyer_name: string | null;
  buyer_email: string | null;
  created_at: string;
  updated_at: string;
}

export const createAgentQRCode = async (
  agentId: string,
  homeData: Record<string, unknown>,
  buyerName?: string,
  buyerEmail?: string,
  notes?: string,
): Promise<AgentHomeQRCode> => {
  const { data, error } = await supabase
    .from('agent_home_qr_codes')
    .insert({
      agent_id: agentId,
      home_data: homeData,
      buyer_name: buyerName || null,
      buyer_email: buyerEmail || null,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAgentQRCodes = async (agentId: string): Promise<AgentHomeQRCode[]> => {
  const { data, error } = await supabase
    .from('agent_home_qr_codes')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getQRCodeByToken = async (token: string): Promise<AgentHomeQRCode | null> => {
  const { data, error } = await supabase
    .from('agent_home_qr_codes')
    .select('*')
    .eq('qr_token', token)
    .eq('status', 'active')
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data;
};

export const claimQRCode = async (token: string, userId: string): Promise<AgentHomeQRCode> => {
  const { data, error } = await supabase
    .from('agent_home_qr_codes')
    .update({
      status: 'claimed',
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('qr_token', token)
    .eq('status', 'active')
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const revokeQRCode = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('agent_home_qr_codes')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

// ─── Technician Documents ───

export type TechDocumentType =
  | 'contractor_agreement'
  | 'safety_acknowledgment'
  | 'w9'
  | 'direct_deposit'
  | 'insurance_verification'
  | 'drivers_license'
  | 'background_check_consent'
  | 'background_check_result';

export interface TechnicianDocument {
  id: string;
  provider_id: string;
  document_type: TechDocumentType;
  file_path: string | null;
  signature_data_url: string | null;
  agreement_version: string | null;
  agreement_text_hash: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_ip: string | null;
  status: 'pending' | 'signed' | 'verified' | 'expired' | 'rejected';
  notes: string | null;
  metadata: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const getTechnicianDocuments = async (providerId: string): Promise<TechnicianDocument[]> => {
  const { data, error } = await supabase
    .from('technician_documents')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const signTechnicianDocument = async (
  providerId: string,
  documentType: TechDocumentType,
  signatureDataUrl: string,
  signerName: string,
  agreementVersion?: string,
  agreementTextHash?: string,
): Promise<TechnicianDocument> => {
  const { data, error } = await supabase
    .from('technician_documents')
    .upsert({
      provider_id: providerId,
      document_type: documentType,
      signature_data_url: signatureDataUrl,
      signer_name: signerName,
      agreement_version: agreementVersion || null,
      agreement_text_hash: agreementTextHash || null,
      signed_at: new Date().toISOString(),
      status: 'signed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider_id,document_type' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const uploadTechnicianDocument = async (
  providerId: string,
  documentType: TechDocumentType,
  file: File,
): Promise<TechnicianDocument> => {
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${providerId}/${documentType}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('technician-documents')
    .upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('technician_documents')
    .upsert({
      provider_id: providerId,
      document_type: documentType,
      file_path: path,
      status: 'signed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider_id,document_type' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─── Stripe Connect for Certified Pros ───
// All three helpers invoke the same stripe-connect-onboard edge function,
// which expects { action, providerId } and returns shape per action.

/** Kick off Express account creation + first onboarding link. */
export const createStripeConnectAccount = async (
  providerId: string,
): Promise<{ accountId: string; onboardingUrl: string }> => {
  const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
    body: { action: 'create', providerId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

/** Generate a fresh onboarding link for a pro whose prior link expired. */
export const refreshStripeConnectOnboarding = async (
  providerId: string,
): Promise<{ accountId: string; onboardingUrl: string }> => {
  const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
    body: { action: 'refresh', providerId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

/** Live status pulled from Stripe (truth for details_submitted / charges_enabled / payouts_enabled).
 *  The edge function also syncs stripe_connect_onboarding_complete in the DB as a side effect. */
export const getStripeConnectLiveStatus = async (
  providerId: string,
): Promise<{
  hasAccount: boolean;
  accountId?: string;
  onboardingComplete: boolean;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}> => {
  const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
    body: { action: 'status', providerId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

/** Lightweight DB-only read — cheap, but can be stale until next status sync. */
export const getStripeConnectStatus = async (providerId: string): Promise<{
  accountId: string | null;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
}> => {
  const { data, error } = await supabase
    .from('pro_providers')
    .select('stripe_connect_account_id, stripe_connect_onboarding_complete')
    .eq('id', providerId)
    .single();
  if (error) throw error;
  return {
    accountId: data.stripe_connect_account_id,
    onboardingComplete: data.stripe_connect_onboarding_complete || false,
    payoutsEnabled: data.stripe_connect_onboarding_complete || false,
  };
};

// ─── Background Check (Placeholder) ───

export const initiateBackgroundCheck = async (providerId: string): Promise<{ checkId: string; status: string }> => {
  // TODO: Integrate with Checkr API
  // For now, update the provider's background_check_status to 'pending'
  const { error } = await supabase
    .from('pro_providers')
    .update({
      background_check_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', providerId);
  if (error) throw error;

  // Note: caller should call logAdminAction separately
  return { checkId: `placeholder_${providerId}`, status: 'pending' };
};

export const updateBackgroundCheckStatus = async (
  providerId: string,
  status: 'cleared' | 'failed',
): Promise<void> => {
  const { error } = await supabase
    .from('pro_providers')
    .update({
      background_check_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', providerId);
  if (error) throw error;
};

// ─── Agent Applications ───

export interface AgentApplication {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  brokerage?: string;
  license_number?: string;
  license_state?: string;
  years_experience?: number;
  bio?: string;
  service_area_zips?: string[];
  photo_url?: string;
  referral_source?: string;
  agreed_to_terms: boolean;
  agreed_to_terms_at?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
}

export const submitAgentApplication = async (app: Partial<AgentApplication>): Promise<AgentApplication> => {
  const { data, error } = await supabase
    .from('agent_applications')
    .insert(app)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAgentApplications = async (status?: string): Promise<AgentApplication[]> => {
  let query = supabase
    .from('agent_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getAgentApplicationById = async (id: string): Promise<AgentApplication> => {
  const { data, error } = await supabase
    .from('agent_applications')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const reviewAgentApplication = async (
  id: string,
  decision: 'approved' | 'rejected',
  reviewedBy: string,
  notes?: string
): Promise<void> => {
  // First get the application data
  const app = await getAgentApplicationById(id);

  if (decision === 'approved') {
    // Create agent record from application
    const { data: agent, error: createErr } = await supabase
      .from('agents')
      .insert({
        id: crypto.randomUUID(),
        name: app.full_name,
        email: app.email,
        phone: app.phone || null,
        brokerage: app.brokerage || null,
        license_number: app.license_number || null,
        license_state: app.license_state || null,
        years_experience: app.years_experience || null,
        bio: app.bio || null,
        service_area_zips: app.service_area_zips || [],
        photo_url: app.photo_url || null,
        application_id: id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createErr) throw createErr;

    // Update application to approved and link agent
    const { error: updateErr } = await supabase
      .from('agent_applications')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Send approval email
    try {
      await sendDirectEmailNotification({
        recipient_email: app.email,
        title: 'Welcome to Canopy Agent Partner Program',
        body: `Congratulations! Your application has been approved. You are now a Canopy Agent Partner and can start creating gift codes for your clients.\n\nSign in at canopyhome.app/agent-portal to get started.`,
        subject: 'Application Approved - Canopy Agent Partner',
        category: 'agent_application',
        action_url: '/agent-portal',
        action_label: 'Access Agent Portal',
      });
    } catch (emailErr) {
      console.error('Failed to send approval email:', emailErr);
    }
  } else {
    // Rejection
    const { error: updateErr } = await supabase
      .from('agent_applications')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Send rejection email
    try {
      await sendDirectEmailNotification({
        recipient_email: app.email,
        title: 'Application Status Update',
        body: `Thank you for your interest in becoming a Canopy Agent Partner. Unfortunately, your application was not approved at this time.\n\n${notes ? `Feedback: ${notes}\n\n` : ''}We encourage you to reapply if circumstances change.`,
        subject: 'Application Decision - Canopy Agent Partner',
        category: 'agent_application',
      });
    } catch (emailErr) {
      console.error('Failed to send rejection email:', emailErr);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// Builder Applications (migration 038)
// ═══════════════════════════════════════════════════════════════

export interface BuilderApplication {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  company_name: string;
  website?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  years_in_business?: number | null;
  annual_home_volume?: number | null;
  service_area_zips?: string[];
  primary_markets?: string | null;
  home_types?: string[];
  price_range?: string | null;
  bio?: string | null;
  logo_url?: string | null;
  referral_source?: string | null;
  agreed_to_terms: boolean;
  agreed_to_terms_at?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Builder {
  id: string;
  application_id?: string | null;
  company_name: string;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  service_area_zips?: string[];
  primary_markets?: string | null;
  home_types?: string[];
  price_range?: string | null;
  annual_home_volume?: number | null;
  bio?: string | null;
  logo_url?: string | null;
  slug?: string | null;
  status: 'active' | 'paused' | 'offboarded';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

function slugifyCompany(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'builder'}-${suffix}`;
}

export const submitBuilderApplication = async (
  app: Partial<BuilderApplication>,
): Promise<BuilderApplication> => {
  const { data, error } = await supabase
    .from('builder_applications')
    .insert(app)
    .select()
    .single();
  if (error) throw error;
  return data as BuilderApplication;
};

export const getBuilderApplications = async (
  status?: string,
): Promise<BuilderApplication[]> => {
  let query = supabase
    .from('builder_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as BuilderApplication[];
};

export const getBuilderApplicationById = async (
  id: string,
): Promise<BuilderApplication> => {
  const { data, error } = await supabase
    .from('builder_applications')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as BuilderApplication;
};

export const reviewBuilderApplication = async (
  id: string,
  decision: 'approved' | 'rejected',
  reviewedBy: string,
  notes?: string,
): Promise<void> => {
  const app = await getBuilderApplicationById(id);

  if (decision === 'approved') {
    const { error: createErr } = await supabase
      .from('builders')
      .insert({
        application_id: id,
        company_name: app.company_name,
        contact_name: app.full_name,
        email: app.email,
        phone: app.phone || null,
        website: app.website || null,
        license_number: app.license_number || null,
        license_state: app.license_state || null,
        service_area_zips: app.service_area_zips || [],
        primary_markets: app.primary_markets || null,
        home_types: app.home_types || [],
        price_range: app.price_range || null,
        annual_home_volume: app.annual_home_volume || null,
        bio: app.bio || null,
        logo_url: app.logo_url || null,
        slug: slugifyCompany(app.company_name),
        status: 'active',
      });
    if (createErr) throw createErr;

    const { error: updateErr } = await supabase
      .from('builder_applications')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateErr) throw updateErr;

    try {
      await sendDirectEmailNotification({
        recipient_email: app.email,
        title: 'Welcome to Canopy Builder Partner Program',
        body: `Your Canopy Builder Partner application has been approved. You can now enroll new-construction homes into Canopy at closing.\n\nWe'll follow up with onboarding details.`,
        subject: 'Application Approved - Canopy Builder Partner',
        category: 'builder_application',
      });
    } catch (emailErr) {
      console.error('Failed to send builder approval email:', emailErr);
    }
  } else {
    const { error: updateErr } = await supabase
      .from('builder_applications')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateErr) throw updateErr;

    try {
      await sendDirectEmailNotification({
        recipient_email: app.email,
        title: 'Application Status Update',
        body: `Thank you for your interest in the Canopy Builder Partner program. Unfortunately, your application was not approved at this time.\n\n${notes ? `Feedback: ${notes}\n\n` : ''}We encourage you to reapply if circumstances change.`,
        subject: 'Application Decision - Canopy Builder Partner',
        category: 'builder_application',
      });
    } catch (emailErr) {
      console.error('Failed to send builder rejection email:', emailErr);
    }
  }
};

export const getBuilders = async (): Promise<Builder[]> => {
  const { data, error } = await supabase
    .from('builders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Builder[];
};

export const getBuilderBySlug = async (slug: string): Promise<Builder | null> => {
  const { data, error } = await supabase
    .from('builders')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return (data as Builder) || null;
};

// ─── Ownership Verification ─────────────────────────────────────

/** Upload a verification document (ID, utility bill, etc.) for a home */
export const uploadVerificationDocument = async (
  homeId: string,
  file: File,
): Promise<string> => {
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${homeId}/verification_${Date.now()}.${ext}`;
  const url = await uploadPhoto('photos', path, file);
  return url;
};

/** Submit ownership verification request */
export const submitOwnershipVerification = async (
  homeId: string,
  documentUrls: string[],
  method: 'document_upload' | 'title_company' | 'manual' = 'document_upload',
): Promise<Home> => {
  const { data, error } = await supabase
    .from('homes')
    .update({
      ownership_verification_status: 'pending',
      ownership_verification_method: method,
      ownership_documents_url: documentUrls.join(','),
      ownership_verification_date: new Date().toISOString(),
    })
    .eq('id', homeId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Admin: Get all homes with pending verification */
export const getPendingVerifications = async (): Promise<Home[]> => {
  const { data, error } = await supabase
    .from('homes')
    .select('*')
    .eq('ownership_verification_status', 'pending')
    .order('ownership_verification_date', { ascending: true });
  if (error) throw error;
  return (data || []) as Home[];
};

/** Admin: Get all homes with any verification status (for history) */
export const getAllVerifications = async (): Promise<Home[]> => {
  const { data, error } = await supabase
    .from('homes')
    .select('*')
    .neq('ownership_verification_status', 'none')
    .not('ownership_verification_status', 'is', null)
    .order('ownership_verification_date', { ascending: false });
  if (error) throw error;
  return (data || []) as Home[];
};

/** Admin: Approve or reject a verification */
export const reviewOwnershipVerification = async (
  homeId: string,
  decision: 'verified' | 'rejected',
  notes?: string,
): Promise<Home> => {
  const updates: Record<string, unknown> = {
    ownership_verification_status: decision,
    ownership_verified: decision === 'verified',
    ownership_verification_date: new Date().toISOString(),
  };
  if (notes) updates.ownership_verification_notes = notes;

  const { data, error } = await supabase
    .from('homes')
    .update(updates)
    .eq('id', homeId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
