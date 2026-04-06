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
