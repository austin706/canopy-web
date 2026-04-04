// ===============================================================
// Canopy Web — Supabase Client & API (web version)
// ===============================================================
import { createClient } from '@supabase/supabase-js';
import type { Home, Equipment, MaintenanceTask, MaintenanceLog, ProProvider } from '@/types';

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

/** Approve a join request — creates a new home record for the requester linked to same address */
export const approveHomeJoinRequest = async (requestId: string) => {
  // Get the request details
  const { data: request, error: reqErr } = await supabase
    .from('home_join_requests')
    .select('*, homes(*)')
    .eq('id', requestId)
    .single();
  if (reqErr || !request) throw reqErr || new Error('Request not found');

  // Create a home copy for the joining user (they get their own home record with same address)
  const originalHome = request.homes;
  const { id: _id, user_id: _uid, created_at: _ca, updated_at: _ua, ...homeFields } = originalHome;
  const { data: newHome, error: homeErr } = await supabase
    .from('homes')
    .insert({ ...homeFields, user_id: request.requester_id })
    .select()
    .single();
  if (homeErr) throw homeErr;

  // Mark request as approved
  await supabase
    .from('home_join_requests')
    .update({ status: 'approved', responded_at: new Date().toISOString() })
    .eq('id', requestId);

  return newHome;
};

/** Deny a join request */
export const denyHomeJoinRequest = async (requestId: string) => {
  const { error } = await supabase
    .from('home_join_requests')
    .update({ status: 'denied', responded_at: new Date().toISOString() })
    .eq('id', requestId);
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
