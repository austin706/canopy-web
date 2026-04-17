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

// ─── Pro Payouts ───

export interface ProPayoutRow {
  id: string;
  visit_id: string;
  provider_id: string;
  provider_user_id: string;
  amount_cents: number;
  stripe_transfer_id: string | null;
  stripe_connect_account: string | null;
  stripe_error: string | null;
  status: 'processing' | 'paid' | 'failed';
  paid_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
  visit?: {
    id: string;
    scheduled_date: string | null;
    completed_at: string | null;
    payout_status: string | null;
    homeowner_id: string | null;
  } | null;
}

/** Fetch payout history for a provider, newest first. */
export const getProviderPayouts = async (providerId: string): Promise<ProPayoutRow[]> => {
  const { data, error } = await supabase
    .from('pro_payouts')
    .select(
      `
      id, visit_id, provider_id, provider_user_id, amount_cents,
      stripe_transfer_id, stripe_connect_account, stripe_error,
      status, paid_at, failed_at, created_at, updated_at,
      visit:pro_monthly_visits ( id, scheduled_date, completed_at, payout_status, homeowner_id )
    `,
    )
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as ProPayoutRow[];
};

/** Payout totals grouped by status — for the Pro Portal earnings card. */
export const getProviderPayoutSummary = async (
  providerId: string,
): Promise<{ paidCents: number; processingCents: number; failedCents: number; count: number }> => {
  const { data, error } = await supabase
    .from('pro_payouts')
    .select('amount_cents, status')
    .eq('provider_id', providerId);
  if (error) throw error;
  const rows = (data || []) as Array<{ amount_cents: number; status: string }>;
  return rows.reduce(
    (acc, r) => {
      if (r.status === 'paid') acc.paidCents += r.amount_cents || 0;
      else if (r.status === 'processing') acc.processingCents += r.amount_cents || 0;
      else if (r.status === 'failed') acc.failedCents += r.amount_cents || 0;
      acc.count += 1;
      return acc;
    },
    { paidCents: 0, processingCents: 0, failedCents: 0, count: 0 },
  );
};

/**
 * List completed visits for this provider that haven't been paid yet.
 * Used by the "Request payout" UI so the pro can manually kick off a
 * transfer for a visit whose auto-payout failed or was skipped.
 */
export const getUnpaidCompletedVisits = async (
  providerId: string,
): Promise<Array<{ id: string; completed_at: string | null; scheduled_date: string | null; payout_status: string | null; payout_amount_cents: number | null }>> => {
  const { data, error } = await supabase
    .from('pro_monthly_visits')
    .select('id, completed_at, scheduled_date, payout_status, payout_amount_cents')
    .eq('pro_provider_id', providerId)
    .eq('status', 'completed')
    .or('payout_status.is.null,payout_status.neq.paid')
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Array<{ id: string; completed_at: string | null; scheduled_date: string | null; payout_status: string | null; payout_amount_cents: number | null }>;
};

/** Manually trigger payout for a specific completed visit via process-pro-payout edge function. */
export const triggerManualPayout = async (visitId: string): Promise<{ success: boolean; payout_id?: string; amount_cents?: number; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('process-pro-payout', {
    body: { visit_id: visitId },
  });
  if (error) {
    logger.error('triggerManualPayout failed', error);
    return { success: false, error: error.message };
  }
  if (data?.error) return { success: false, error: data.error };
  return { success: true, payout_id: data?.payout_id, amount_cents: data?.amount_cents };
};

// ─── Background Check (Checkr) ───
// Wired through the `checkr-initiate` edge function (see
// Canopy-App/supabase/functions/checkr-initiate/index.ts).
// The function:
//   1. Creates a Checkr candidate + report (or reuses existing ids)
//   2. Stores checkr_candidate_id / checkr_report_id on pro_providers
//   3. Flips background_check_status to 'pending'
//   4. Writes an admin_audit_log entry
// If CHECKR_API_KEY isn't configured server-side, the function falls back to
// placeholder refs so pre-launch testing still works; the response includes
// `fallback: true` so the UI can surface a notice.

export const initiateBackgroundCheck = async (
  providerId: string,
): Promise<{ checkId: string; status: string; fallback?: boolean }> => {
  const { data, error } = await supabase.functions.invoke('checkr-initiate', {
    body: { provider_id: providerId },
  });
  if (error) throw error;
  const result = (data || {}) as {
    candidate_id?: string;
    report_id?: string;
    status?: string;
    fallback?: boolean;
  };
  return {
    checkId: result.report_id || result.candidate_id || `placeholder_${providerId}`,
    status: result.status || 'pending',
    fallback: result.fallback,
  };
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
