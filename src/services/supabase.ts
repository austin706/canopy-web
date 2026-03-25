// ===============================================================
// Canopy Web — Supabase Client & API (web version)
// ===============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// --- Auth ---
export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
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

// --- Home Profile ---
export const getHome = async (userId: string) => {
  const { data, error } = await supabase.from('homes').select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const createHome = async (home: any) => {
  const { data, error } = await supabase.from('homes').insert(home).select().single();
  if (error) throw error;
  return data;
};

export const upsertHome = async (home: any) => {
  const { data, error } = await supabase.from('homes').upsert(home).select().single();
  if (error) throw error;
  return data;
};

// --- Equipment ---
export const getEquipment = async (homeId: string) => {
  const { data, error } = await supabase.from('equipment').select('*').eq('home_id', homeId).order('category');
  if (error) throw error;
  return data || [];
};

export const upsertEquipment = async (equipment: any) => {
  const { data, error } = await supabase.from('equipment').upsert(equipment).select().single();
  if (error) throw error;
  return data;
};

export const deleteEquipment = async (id: string) => {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
};

// --- Tasks ---
export const getTasks = async (homeId: string) => {
  const { data, error } = await supabase.from('maintenance_tasks').select('*').eq('home_id', homeId).order('due_date');
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

export const createTask = async (task: any) => {
  const { data, error } = await supabase.from('maintenance_tasks').insert(task).select().single();
  if (error) throw error;
  return data;
};

export const createTasks = async (tasks: any[]) => {
  const { data, error } = await supabase.from('maintenance_tasks').insert(tasks).select();
  if (error) throw error;
  return data || [];
};

// --- Maintenance Log ---
export const getMaintenanceLogs = async (homeId: string) => {
  const { data, error } = await supabase.from('maintenance_logs').select('*').eq('home_id', homeId).order('completed_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const addMaintenanceLog = async (log: any) => {
  const { data, error } = await supabase.from('maintenance_logs').insert(log).select().single();
  if (error) throw error;
  return data;
};

// --- Photo Upload ---
export const uploadPhoto = async (bucket: string, path: string, file: File) => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
};

// --- Profile Management ---
export const updateProfile = async (userId: string, updates: any) => {
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
  await supabase.from('profiles').update({ subscription_tier: gc.tier, subscription_expires_at: newExpiry.toISOString(), agent_id: gc.agent_id }).eq('id', userId);

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
export const createProRequest = async (request: any) => {
  const { data, error } = await supabase.from('pro_requests').insert(request).select().single();
  if (error) throw error;
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

export const updateProRequest = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('pro_requests').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const getAllProProviders = async () => {
  const { data, error } = await supabase.from('pro_providers').select('id, business_name, contact_name, service_categories, is_available').order('business_name');
  if (error) throw error;
  return data || [];
};

// --- Admin Functions ---
export const getAllAgents = async () => {
  const { data, error } = await supabase.from('agents').select('*').order('name');
  if (error) throw error;
  return data || [];
};

export const createAgentRecord = async (agent: any) => {
  const { data, error } = await supabase.from('agents').insert(agent).select().single();
  if (error) throw error;
  return data;
};

export const updateAgent = async (agentId: string, updates: any) => {
  const { data, error } = await supabase.from('agents').update(updates).eq('id', agentId).select().single();
  if (error) throw error;
  return data;
};

export const getAllUsers = async () => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getAllGiftCodes = async () => {
  const { data, error } = await supabase.from('gift_codes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createGiftCodes = async (codes: any[]) => {
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

export const getClientEquipment = async (homeId: string) => {
  const { data, error } = await supabase.from('equipment').select('*').eq('home_id', homeId).order('category');
  if (error) throw error;
  return data || [];
};

export const getClientTasks = async (homeId: string) => {
  const { data, error } = await supabase.from('maintenance_tasks').select('*').eq('home_id', homeId).order('due_date');
  if (error) throw error;
  return data || [];
};

export const upsertClientHome = async (home: any) => {
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
}) => {
  const { data, error } = await supabase.from('pro_interest').insert(interest).select().single();
  if (error) throw error;
  return data;
};

// --- Account Deletion ---
export const deleteUserAccount = async (userId: string) => {
  const { error } = await supabase.rpc('delete_user_and_data', { target_user_id: userId });
  if (error) throw error;
};

// --- Notifications Feed ---
export const getNotifications = async (userId: string, limit = 50) => {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
};

export const getUnreadNotificationCount = async (userId: string) => {
  const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
  return count || 0;
};

export const markNotificationRead = async (id: string) => {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
};

export const markAllNotificationsRead = async (userId: string) => {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
};

// --- Notification Preferences ---
export const getNotificationPreferences = async (userId: string) => {
  const { data, error } = await supabase.from('profiles').select('notification_preferences').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.notification_preferences || null;
};

export const updateNotificationPreferences = async (userId: string, preferences: any) => {
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
