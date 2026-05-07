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
export const redeemGiftCode = async (code: string, userId: string) => {
  const { data: gc, error: lookupErr } = await supabase.from('gift_codes').select('*').eq('code', code.trim().toUpperCase()).single();
  if (lookupErr || !gc) throw new Error('Invalid code');
  if (gc.redeemed_by) throw new Error('Code already redeemed');
  if (gc.expires_at && new Date(gc.expires_at) < new Date()) throw new Error('Code expired');

  const newExpiry = new Date();
  newExpiry.setMonth(newExpiry.getMonth() + (gc.duration_months || 12));
  await supabase.from('gift_codes').update({ redeemed_by: userId, redeemed_at: new Date().toISOString() }).eq('id', gc.id);
  // P0-12 (2026-04-22): always write subscription_source='gift' + status='active'
  // so revenue attribution, RC listener guard, and renewal flows all agree on
  // provenance. Without this, a gift redemption on a user previously on
  // stripe/RC could be silently overwritten by a stale stripe listener.
  const profileUpdate: Record<string, unknown> = {
    subscription_tier: gc.tier,
    subscription_status: 'active',
    subscription_source: 'gift',
    subscription_expires_at: newExpiry.toISOString(),
    agent_id: gc.agent_id,
  };
  if (gc.client_name) profileUpdate.full_name = gc.client_name;
  await supabase.from('profiles').update(profileUpdate).eq('id', userId);

  // If the gift code has a pending home (pre-configured by agent), create it for the user
  let createdHomeId: string | null = null;
  if (gc.pending_home && typeof gc.pending_home === 'object') {
    createdHomeId = crypto.randomUUID();
    const homeData = {
      id: createdHomeId,
      user_id: userId,
      ...gc.pending_home,
      created_at: new Date().toISOString(),
    };
    await supabase.from('homes').upsert(homeData);
    // Mark onboarding as complete since home is set up
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId);
  }

  // 2026-05-07 (Phase 2): apply pending_equipment if the agent pre-captured
  // any equipment for this home. Each entry becomes an equipment row tied
  // to the newly-created home. Only fires if a home was created from
  // pending_home — equipment without a home would orphan, so we skip it.
  if (createdHomeId && Array.isArray(gc.pending_equipment) && gc.pending_equipment.length > 0) {
    const rawList = gc.pending_equipment as Array<Record<string, unknown>>;
    const cleanRows: Array<Record<string, unknown>> = rawList
      .filter((e: unknown): e is Record<string, unknown> => e !== null && typeof e === 'object')
      .map((eq: Record<string, unknown>) => {
        // Defaults satisfy the NOT NULL constraints. Agent UIs should
        // always populate `name` + `category`, but if a record sneaks
        // through without them we don't want the whole transaction to
        // fail — better to land an equipment row that the buyer can
        // edit than to lose the entire pre-onboard.
        const fallbackName = typeof eq.make === 'string' && typeof eq.model === 'string'
          ? `${eq.make} ${eq.model}`
          : 'Equipment';
        return {
          ...eq,
          id: crypto.randomUUID(),
          // Force home_id over anything in the JSONB so a malformed entry
          // can't write equipment to a different home.
          home_id: createdHomeId!,
          category: typeof eq.category === 'string' ? eq.category : 'other',
          name: typeof eq.name === 'string' ? eq.name : fallbackName,
          created_at: new Date().toISOString(),
        };
      });
    if (cleanRows.length > 0) {
      const { error: equipErr } = await supabase.from('equipment').insert(cleanRows);
      // Non-fatal: if equipment insert fails (RLS, constraint, etc.), we
      // still want the redemption to succeed. The buyer can re-add later.
      if (equipErr) {
        // eslint-disable-next-line no-console
        console.warn('[redeemGiftCode] pending_equipment insert failed:', equipErr);
      }
    }
  }

  let agent = null;
  if (gc.agent_id) {
    const { data } = await supabase.from('agents').select('*').eq('id', gc.agent_id).single();
    agent = data;
  }

  // Notify the user of their new subscription
  try {
    const tierLabel = gc.tier === 'home' ? 'Canopy Home' : gc.tier === 'pro' ? 'Canopy Pro' : gc.tier;
    await sendNotification({
      user_id: userId,
      title: 'Welcome to Canopy!',
      body: `Your ${tierLabel} subscription is now active${agent ? `, courtesy of your real estate agent` : ''}. Explore your dashboard to get started with smart home maintenance.`,
      category: 'account_billing',
      action_url: '/dashboard',
    });
  } catch {}

  return { success: true, tier: gc.tier, expiresAt: newExpiry.toISOString(), agent };
};

export const getAgent = async (agentId: string) => {
  await verifyAgentOwnership(agentId);
  const { data, error } = await supabase.from('agents').select('*').eq('id', agentId).single();
  if (error) throw error;
  return data;
};
