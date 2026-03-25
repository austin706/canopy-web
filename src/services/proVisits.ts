import { supabase } from '@/services/supabase';
import type { ProMonthlyVisit, VisitAllocation } from '@/types';
import { TASK_TEMPLATES } from '@/constants/maintenance';

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
    await supabase.rpc('increment_forfeited_visits', {
      p_homeowner_id: visit.homeowner_id,
      p_visit_month: visitMonth,
    }).then(() => {});
  }

  return { rebookable };
}

export async function rescheduleVisit(visitId: string, newDate: string, newTimeSlot: string): Promise<void> {
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
