import { supabase, sendNotification } from '@/services/supabase';
import type { ProMonthlyVisit, VisitAllocation } from '@/types';
import { TASK_TEMPLATES } from '@/constants/maintenance';

// ─── Internal Helpers ───

/** Fetch the provider's user_id (for notifications) from a visit record */
async function getProviderUserId(visitId: string): Promise<{ providerId: string; providerUserId: string | null; providerName: string }> {
  const { data } = await supabase
    .from('pro_monthly_visits')
    .select('pro_provider_id, provider:pro_providers(user_id, business_name, contact_name)')
    .eq('id', visitId)
    .single() as unknown as { data: { pro_provider_id: string; provider: { user_id: string | null; business_name: string | null; contact_name: string | null } | null } | null };
  const provider = data?.provider;
  return {
    providerId: data?.pro_provider_id || '',
    providerUserId: provider?.user_id || null,
    providerName: provider?.business_name || provider?.contact_name || 'Provider',
  };
}

/** Fetch homeowner display name from a visit */
async function getHomeownerInfo(homeownerId: string): Promise<{ name: string; address: string }> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', homeownerId)
    .single();
  const name = data?.full_name || data?.email || 'Homeowner';
  // Also get home address for context
  const { data: home } = await supabase
    .from('homes')
    .select('address, city')
    .eq('user_id', homeownerId)
    .limit(1)
    .single();
  const address = home ? `${home.address}, ${home.city}` : '';
  return { name, address };
}

const CANCELLATION_WINDOW_HOURS = 48;

// ─── Helper Functions ───

export function getItemsToHaveOnHand(selectedTaskIds: string[]): string[] {
  const items = new Set<string>();

  selectedTaskIds.forEach(taskId => {
    const template = TASK_TEMPLATES.find(t => t.id === taskId);
    if (template?.items_to_have_on_hand) {
      template.items_to_have_on_hand.forEach(item => items.add(item));
    }
  });

  return Array.from(items).sort();
}

// ─── Homeowner Functions ───

export async function getUpcomingVisits(homeownerId: string): Promise<ProMonthlyVisit[]> {
  const { data, error } = await supabase
    .from('pro_monthly_visits')
    .select('*, provider:pro_providers(*)')
    .eq('homeowner_id', homeownerId)
    .in('status', ['proposed', 'confirmed'])
    .order('confirmed_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getPastVisits(homeownerId: string, limit = 10): Promise<ProMonthlyVisit[]> {
  const { data, error } = await supabase
    .from('pro_monthly_visits')
    .select('*, provider:pro_providers(*)')
    .eq('homeowner_id', homeownerId)
    .in('status', ['completed', 'cancelled', 'forfeited', 'no_show'])
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function confirmVisit(visitId: string): Promise<void> {
  const { error } = await supabase
    .from('pro_monthly_visits')
    .update({
      status: 'confirmed',
      homeowner_confirmed_at: new Date().toISOString(),
    })
    .eq('id', visitId);
  if (error) throw error;

  // Notify the provider that the homeowner confirmed
  try {
    const { data: visit } = await supabase.from('pro_monthly_visits').select('homeowner_id, proposed_date, confirmed_date').eq('id', visitId).single();
    if (visit) {
      const { providerUserId } = await getProviderUserId(visitId);
      const { name } = await getHomeownerInfo(visit.homeowner_id);
      const dateStr = new Date((visit.confirmed_date || visit.proposed_date) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (providerUserId) {
        sendNotification({
          user_id: providerUserId,
          title: 'Visit Confirmed',
          body: `${name} has confirmed their visit on ${dateStr}.`,
          category: 'pro_service',
          action_url: '/pro-portal',
        }).catch(() => {});
      }
    }
  } catch (e) { console.warn('Failed to send visit confirmation notification:', e); }
}

export async function cancelVisit(visitId: string, reason: string): Promise<{ rebookable: boolean }> {
  // Fetch the visit to check timing
  const { data: visit, error: fetchError } = await supabase
    .from('pro_monthly_visits')
    .select('*')
    .eq('id', visitId)
    .single();
  if (fetchError || !visit) throw fetchError || new Error('Visit not found');

  const confirmedDate = visit.confirmed_date || visit.proposed_date;
  const hoursUntil = confirmedDate
    ? (new Date(confirmedDate).getTime() - Date.now()) / (1000 * 60 * 60)
    : 999;

  const rebookable = hoursUntil >= CANCELLATION_WINDOW_HOURS;
  const newStatus = rebookable ? 'cancelled' : 'forfeited';

  const { error } = await supabase
    .from('pro_monthly_visits')
    .update({
      status: newStatus,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      hours_before_cancellation: Math.round(hoursUntil * 100) / 100,
      same_month_rebookable: rebookable,
    })
    .eq('id', visitId);
  if (error) throw error;

  // Update allocation if forfeited
  if (!rebookable) {
    const visitMonth = visit.visit_month;
    const { error: rpcError } = await supabase.rpc('increment_forfeited_visits', {
      p_homeowner_id: visit.homeowner_id,
      p_visit_month: visitMonth,
    });
    if (rpcError) {
      console.error('Failed to increment forfeited visits:', rpcError);
      throw new Error('Visit was cancelled but allocation update failed. Please contact support.');
    }
  }

  // Notify the provider about the cancellation
  try {
    const { providerUserId } = await getProviderUserId(visitId);
    const { name } = await getHomeownerInfo(visit.homeowner_id);
    const dateStr = new Date((visit.confirmed_date || visit.proposed_date) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (providerUserId) {
      sendNotification({
        user_id: providerUserId,
        title: rebookable ? 'Visit Cancelled' : 'Visit Cancelled (Forfeited)',
        body: rebookable
          ? `${name} has cancelled their visit on ${dateStr}. Reason: ${reason}. They can still rebook this month.`
          : `${name} has cancelled their visit on ${dateStr} within 48 hours. Reason: ${reason}. This month's visit has been forfeited.`,
        category: 'pro_service',
        action_url: '/pro-portal',
      }).catch(() => {});
    }
  } catch (e) { console.warn('Failed to send cancellation notification:', e); }

  return { rebookable };
}

export async function rescheduleVisit(visitId: string, newDate: string, newTimeSlot: string): Promise<void> {
  // Fetch visit before update so we can notify provider
  const { data: visit } = await supabase.from('pro_monthly_visits').select('homeowner_id').eq('id', visitId).single();

  const { error } = await supabase
    .from('pro_monthly_visits')
    .update({
      status: 'proposed',
      proposed_date: newDate,
      proposed_time_slot: newTimeSlot,
      homeowner_confirmed_at: null,
      confirmed_date: null,
      confirmed_start_time: null,
      confirmed_end_time: null,
    })
    .eq('id', visitId);
  if (error) throw error;

  // Notify provider about the reschedule
  if (visit) {
    try {
      const { providerUserId } = await getProviderUserId(visitId);
      const { name } = await getHomeownerInfo(visit.homeowner_id);
      const dateStr = new Date(newDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (providerUserId) {
        sendNotification({
          user_id: providerUserId,
          title: 'Visit Rescheduled',
          body: `${name} has rescheduled their visit to ${dateStr} (${newTimeSlot}). Please review and confirm.`,
          category: 'pro_service',
          action_url: '/pro-portal',
        }).catch(() => {});
      }
    } catch (e) { console.warn('Failed to send reschedule notification:', e); }
  }
}

export async function getVisitAllocation(homeownerId: string, visitMonth: string): Promise<VisitAllocation | null> {
  const { data, error } = await supabase
    .from('pro_visit_allocations')
    .select('*')
    .eq('homeowner_id', homeownerId)
    .eq('visit_month', visitMonth)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ─── Pro Provider Functions ───

export async function proposeVisit(
  homeId: string,
  homeownerId: string,
  providerId: string,
  visitMonth: string,
  proposedDate: string,
  proposedTimeSlot: string,
  selectedTaskIds: string[]
): Promise<ProMonthlyVisit> {
  const { data, error } = await supabase
    .from('pro_monthly_visits')
    .insert({
      home_id: homeId,
      homeowner_id: homeownerId,
      pro_provider_id: providerId,
      visit_month: visitMonth,
      proposed_date: proposedDate,
      proposed_time_slot: proposedTimeSlot,
      selected_task_ids: selectedTaskIds,
      status: 'proposed',
    })
    .select()
    .single();
  if (error) throw error;

  // Notify the homeowner about the proposed visit
  try {
    const { data: provider } = await supabase.from('pro_providers').select('business_name, contact_name').eq('id', providerId).single();
    const providerName = provider?.business_name || provider?.contact_name || 'Your Canopy Pro';
    const dateStr = new Date(proposedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    sendNotification({
      user_id: homeownerId,
      title: 'New Visit Proposed',
      body: `${providerName} has proposed a visit on ${dateStr} (${proposedTimeSlot}). Please confirm or reschedule on the Pro Services page.`,
      category: 'pro_service',
      action_url: '/pro-services',
    }).catch(() => {});
  } catch (e) { console.warn('Failed to send visit proposal notification:', e); }

  return data;
}

export async function startVisit(visitId: string): Promise<void> {
  const { error } = await supabase
    .from('pro_monthly_visits')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', visitId);
  if (error) throw error;
}

export async function completeVisit(
  visitId: string,
  completedTaskIds: string[],
  timeSpentMinutes: number,
  notes: string,
  photos: { url: string; caption?: string }[]
): Promise<void> {
  // Fetch homeowner ID before update
  const { data: visit } = await supabase.from('pro_monthly_visits').select('homeowner_id, pro_provider_id').eq('id', visitId).single();

  const { error } = await supabase
    .from('pro_monthly_visits')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      selected_task_ids: completedTaskIds,
      time_spent_minutes: timeSpentMinutes,
      pro_notes: notes,
      photos,
    })
    .eq('id', visitId);
  if (error) throw error;

  // Notify homeowner that the visit is complete
  if (visit) {
    try {
      const { data: provider } = await supabase.from('pro_providers').select('business_name, contact_name').eq('id', visit.pro_provider_id).single();
      const providerName = provider?.business_name || provider?.contact_name || 'Your Canopy Pro';
      const taskCount = completedTaskIds.length;
      const hours = Math.floor(timeSpentMinutes / 60);
      const mins = timeSpentMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;
      sendNotification({
        user_id: visit.homeowner_id,
        title: 'Home Visit Completed',
        body: `${providerName} has completed your home visit — ${taskCount} tasks done in ${timeStr}. Your detailed AI summary will be ready shortly.`,
        category: 'pro_service',
        action_url: '/pro-services',
      }).catch(() => {});
    } catch (e) { console.warn('Failed to send visit completion notification:', e); }
  }

  // Trigger payout processing (fire-and-forget — payout failure
  // doesn't block visit completion; admin can retry from dashboard)
  try {
    await triggerVisitPayout(visitId);
  } catch (payoutErr) {
    console.warn(`Payout trigger failed for visit ${visitId} — admin can retry:`, payoutErr);
  }
}

/**
 * Trigger payout to the pro tech for a completed visit.
 * Creates a Stripe Transfer from Canopy's balance to the tech's Connect account.
 */
export async function triggerVisitPayout(visitId: string): Promise<{
  success: boolean;
  payout_id?: string;
  amount_cents?: number;
  stripe_transfer_id?: string;
  error?: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await supabase.functions.invoke('process-pro-payout', {
    body: { visit_id: visitId },
  });

  if (res.error) {
    throw new Error(res.error.message || 'Payout processing failed');
  }

  return res.data;
}

export async function rateVisit(
  visitId: string,
  rating: number,
  review?: string
): Promise<void> {
  const { error } = await supabase
    .from('pro_monthly_visits')
    .update({
      homeowner_rating: rating,
      homeowner_review: review || null,
      rated_at: new Date().toISOString(),
    })
    .eq('id', visitId);
  if (error) throw error;

  // Notify the provider about the rating
  try {
    const { data: visit } = await supabase.from('pro_monthly_visits').select('homeowner_id').eq('id', visitId).single();
    if (visit) {
      const { providerUserId } = await getProviderUserId(visitId);
      const { name } = await getHomeownerInfo(visit.homeowner_id);
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      if (providerUserId) {
        sendNotification({
          user_id: providerUserId,
          title: 'New Visit Rating',
          body: `${name} rated their visit ${stars} (${rating}/5).${review ? ` "${review}"` : ''}`,
          category: 'pro_service',
          action_url: '/pro-portal',
        }).catch(() => {});
      }
    }
  } catch (e) { console.warn('Failed to send rating notification:', e); }
}

export async function getProviderVisits(providerId: string, month?: string): Promise<ProMonthlyVisit[]> {
  let query = supabase
    .from('pro_monthly_visits')
    .select('*, provider:pro_providers(*)')
    .eq('pro_provider_id', providerId)
    .order('confirmed_date', { ascending: true });

  if (month) {
    query = query.eq('visit_month', month);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
