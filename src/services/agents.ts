// ===============================================================
// Agents Domain (Agent Linking, Gift Codes)
// ===============================================================
import { supabase } from './supabaseClient';

// Security: Verify that the current user owns the agent record (S6)
export const verifyAgentOwnership = async (agentId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('User not authenticated');

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('agent_id, role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) throw new Error('Profile not found');

  // Allow access if user is admin OR if agent_id matches
  if (profile.role !== 'admin' && profile.agent_id !== agentId) {
    throw new Error('Unauthorized: You do not own this agent record');
  }
};

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
  await verifyAgentOwnership(agentId);
  const { data, error } = await supabase.from('agents').select('*').eq('id', agentId).single();
  if (error) throw error;
  return data;
};
