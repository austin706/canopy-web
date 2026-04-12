// ═══════════════════════════════════════════════════════════════
// Referral Program Service
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabaseClient';

export interface ReferralCode {
  code: string;
  uses: number;
  active: boolean;
}

export interface ReferralRedemption {
  id: string;
  referrer_id: string;
  referee_id: string;
  status: 'pending' | 'qualified' | 'rewarded' | 'expired';
  referee_subscribed_at: string | null;
  referrer_credit_applied: boolean;
  referee_credit_applied: boolean;
  created_at: string;
}

/**
 * Get or create the current user's referral code.
 */
export async function getOrCreateReferralCode(): Promise<ReferralCode | null> {
  const { data, error } = await supabase.rpc('get_or_create_referral_code');
  if (error) throw error;
  return data?.[0] || null;
}

/**
 * Redeem a referral code (called during signup flow).
 */
export async function redeemReferralCode(code: string): Promise<{ success: boolean; error?: string; referrer_name?: string }> {
  const { data, error } = await supabase.rpc('redeem_referral_code', { p_code: code });
  if (error) throw error;
  return data as { success: boolean; error?: string; referrer_name?: string };
}

/**
 * Get the current user's referral stats (how many friends referred + their status).
 */
export async function getReferralStats(): Promise<{
  code: string | null;
  totalReferred: number;
  pendingReferred: number;
  qualifiedReferred: number;
  rewardedReferred: number;
}> {
  // Get code
  const codeResult = await getOrCreateReferralCode();

  // Get redemptions where current user is referrer
  const { data: redemptions, error } = await supabase
    .from('referral_redemptions')
    .select('status')
    .eq('referrer_id', (await supabase.auth.getUser()).data.user?.id || '');

  if (error) throw error;

  const stats = {
    code: codeResult?.code || null,
    totalReferred: redemptions?.length || 0,
    pendingReferred: redemptions?.filter(r => r.status === 'pending').length || 0,
    qualifiedReferred: redemptions?.filter(r => r.status === 'qualified').length || 0,
    rewardedReferred: redemptions?.filter(r => r.status === 'rewarded').length || 0,
  };

  return stats;
}
