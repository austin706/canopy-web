// ===============================================================
// Pro Domain (Pro Requests, Pro Providers, Pro Interest)
// ===============================================================
import { supabase } from './supabaseClient';
import logger from '@/utils/logger';
import type { ProProvider } from '@/types';


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

// ─── Stripe Connect Integration ───

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

// --- Account Deletion ---
