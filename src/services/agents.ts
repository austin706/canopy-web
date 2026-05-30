// ===============================================================
// Agents Domain (Agent Linking, Gift Codes)
// ===============================================================
import { supabase } from './supabaseClient';
import { sendNotification } from './notifications';

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
// 2026-05-29 (subscription hardening / migration 101): atomic, server-
// authoritative redemption via the `redeem_gift_code` RPC. The RPC does the
// single-use claim AND the subscription grant under SECURITY DEFINER (so it
// passes migration 102's BEFORE UPDATE trigger on profiles). Client only
// builds pre-configured home/equipment + sends the welcome notification.
export const redeemGiftCode = async (code: string, userId: string) => {
  const { data, error } = await supabase.rpc('redeem_gift_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  if (!data?.success) {
    const msg = (
      {
        not_authenticated: 'Please sign in to redeem this code.',
        invalid_code: 'Invalid code',
        code_not_found: 'Invalid code',
        already_redeemed: 'Code already redeemed',
        expired: 'Code expired',
      } as Record<string, string>
    )[String(data?.error || '')] || 'Invalid code';
    throw new Error(msg);
  }

  // 2026-05-29: client_name is no longer auto-written to the user's
  // full_name by the RPC (full_name is a privileged column under migration
  // 100's trigger surface). Write it client-side only if the user's profile
  // currently has no full_name set — otherwise leave alone.
  if (data.client_name) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
    if (profile && !profile.full_name) {
      await supabase.from('profiles').update({ full_name: data.client_name }).eq('id', userId);
    }
  }

  // Build pending_home (non-sensitive — homes are a separate concern).
  let createdHomeId: string | null = null;
  if (data.pending_home && typeof data.pending_home === 'object') {
    createdHomeId = crypto.randomUUID();
    const homeData = {
      id: createdHomeId,
      user_id: userId,
      ...data.pending_home,
      created_at: new Date().toISOString(),
    };
    await supabase.from('homes').upsert(homeData);
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId);
  }

  if (createdHomeId && Array.isArray(data.pending_equipment) && data.pending_equipment.length > 0) {
    const rawList = data.pending_equipment as Array<Record<string, unknown>>;
    const cleanRows: Array<Record<string, unknown>> = rawList
      .filter((e: unknown): e is Record<string, unknown> => e !== null && typeof e === 'object')
      .map((eq: Record<string, unknown>) => {
        const fallbackName = typeof eq.make === 'string' && typeof eq.model === 'string'
          ? `${eq.make} ${eq.model}`
          : 'Equipment';
        return {
          ...eq,
          id: crypto.randomUUID(),
          home_id: createdHomeId!,
          category: typeof eq.category === 'string' ? eq.category : 'other',
          name: typeof eq.name === 'string' ? eq.name : fallbackName,
          created_at: new Date().toISOString(),
        };
      });
    if (cleanRows.length > 0) {
      const { error: equipErr } = await supabase.from('equipment').insert(cleanRows);
      if (equipErr) {
        // eslint-disable-next-line no-console
        console.warn('[redeemGiftCode] pending_equipment insert failed:', equipErr);
      }
    }
  }

  let agent = null;
  if (data.agent_id) {
    const { data: agentRow } = await supabase.from('agents').select('*').eq('id', data.agent_id).single();
    agent = agentRow;
  }

  // Welcome notification (non-blocking).
  try {
    const tierLabel = data.tier === 'home' ? 'Canopy Home' : data.tier === 'pro' ? 'Canopy Pro' : data.tier;
    await sendNotification({
      user_id: userId,
      title: 'Welcome to Canopy!',
      body: `Your ${tierLabel} subscription is now active${agent ? `, courtesy of your real estate agent` : ''}. Explore your dashboard to get started with smart home maintenance.`,
      category: 'account_billing',
      action_url: '/dashboard',
    });
  } catch {}

  return { success: true, tier: data.tier, expiresAt: data.expires_at, agent };
};

export const getAgent = async (agentId: string) => {
  await verifyAgentOwnership(agentId);
  const { data, error } = await supabase.from('agents').select('*').eq('id', agentId).single();
  if (error) throw error;
  return data;
};
