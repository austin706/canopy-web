import { supabase } from '@/services/supabase';
import type { ProPlusSubscription } from '@/types';

// ─── Homeowner Functions ───

export async function requestConsultation(homeId: string, providerId: string): Promise<ProPlusSubscription> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pro_plus_subscriptions')
    .insert({
      homeowner_id: user.id,
      home_id: homeId,
      pro_provider_id: providerId,
      consultation_requested_at: new Date().toISOString(),
      status: 'consultation_requested',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProPlusStatus(homeownerId: string): Promise<ProPlusSubscription | null> {
  const { data, error } = await supabase
    .from('pro_plus_subscriptions')
    .select('*, provider:pro_providers(*)')
    .eq('homeowner_id', homeownerId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function approveQuote(subscriptionId: string): Promise<void> {
  const { data: sub, error: fetchError } = await supabase
    .from('pro_plus_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();
  if (fetchError || !sub) throw fetchError || new Error('Subscription not found');

  // Call Edge Function to create Stripe subscription with custom amount
  const { error: fnError } = await supabase.functions.invoke('create-pro-plus-subscription', {
    body: {
      subscription_id: subscriptionId,
      monthly_rate: sub.quoted_monthly_rate,
      homeowner_id: sub.homeowner_id,
    },
  });
  if (fnError) throw fnError;

  // Update local status
  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({
      status: 'active',
      homeowner_approved_at: new Date().toISOString(),
      current_monthly_rate: sub.quoted_monthly_rate,
      started_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
  if (error) throw error;
}

export async function cancelProPlus(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
  if (error) throw error;
}

export async function pauseProPlus(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({ status: 'paused' })
    .eq('id', subscriptionId);
  if (error) throw error;
}

// ─── Pro Provider Functions ───

export async function getProPlusCustomers(providerId: string): Promise<ProPlusSubscription[]> {
  const { data, error } = await supabase
    .from('pro_plus_subscriptions')
    .select('*')
    .eq('pro_provider_id', providerId)
    .in('status', ['consultation_requested', 'consultation_scheduled', 'consultation_completed', 'quote_pending', 'quote_approved', 'active'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function scheduleConsultation(subscriptionId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({
      status: 'consultation_scheduled',
      consultation_scheduled_date: date,
    })
    .eq('id', subscriptionId);
  if (error) throw error;
}

export async function completeConsultation(subscriptionId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({
      status: 'consultation_completed',
      consultation_completed_at: new Date().toISOString(),
      consultation_notes: notes,
    })
    .eq('id', subscriptionId);
  if (error) throw error;
}

export async function submitQuote(subscriptionId: string, monthlyRate: number, validUntil: string, coverageNotes: string): Promise<void> {
  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({
      status: 'quote_pending',
      quoted_monthly_rate: monthlyRate,
      quoted_at: new Date().toISOString(),
      quote_valid_until: validUntil,
      coverage_notes: coverageNotes,
    })
    .eq('id', subscriptionId);
  if (error) throw error;
}
