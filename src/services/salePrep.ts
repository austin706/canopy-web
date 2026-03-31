import { supabase, sendNotification } from '@/services/supabase';

export interface HomeSalePrep {
  id: string;
  home_id: string;
  user_id: string;
  activated_at: string;
  target_list_date?: string;
  completed_items: string[];
  agent_notified_at?: string;
  status: 'active' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

/** Get the active sale prep for a home (only one active at a time) */
export async function getActiveSalePrep(homeId: string): Promise<HomeSalePrep | null> {
  const { data, error } = await supabase
    .from('home_sale_prep')
    .select('*')
    .eq('home_id', homeId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Activate sale prep mode for a home */
export async function activateSalePrep(
  homeId: string,
  userId: string,
  targetListDate?: string
): Promise<HomeSalePrep> {
  const { data, error } = await supabase
    .from('home_sale_prep')
    .insert({
      home_id: homeId,
      user_id: userId,
      target_list_date: targetListDate || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Toggle a checklist item (add or remove from completed_items) */
export async function toggleSalePrepItem(
  prepId: string,
  itemId: string,
  completed: boolean,
  currentItems: string[]
): Promise<string[]> {
  const newItems = completed
    ? [...currentItems, itemId]
    : currentItems.filter(id => id !== itemId);

  const { error } = await supabase
    .from('home_sale_prep')
    .update({
      completed_items: newItems,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prepId);
  if (error) throw error;
  return newItems;
}

/** Update target list date */
export async function updateTargetDate(prepId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('home_sale_prep')
    .update({
      target_list_date: date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prepId);
  if (error) throw error;
}

/** Mark sale prep as completed or cancelled */
export async function closeSalePrep(prepId: string, status: 'completed' | 'cancelled'): Promise<void> {
  const { error } = await supabase
    .from('home_sale_prep')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prepId);
  if (error) throw error;
}

/** Notify the homeowner's linked agent that sale prep has been activated */
export async function notifyAgentSalePrep(
  userId: string,
  agentId: string,
  homeAddress: string
): Promise<void> {
  // Resolve agent's auth uid (profiles.id) from agents table id
  // agents.id != profiles.id — we need the profile id for notification delivery
  let notifyUserId = agentId;
  try {
    const { data: agentData } = await supabase
      .from('agents')
      .select('email')
      .eq('id', agentId)
      .single();
    if (agentData?.email) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', agentData.email)
        .single();
      if (profileData?.id) {
        notifyUserId = profileData.id;
      }
    }
  } catch {
    // Fall back to agentId if lookup fails
  }

  // Send notification via edge function (in-app + email + push)
  try {
    await sendNotification({
      user_id: notifyUserId,
      title: 'Client preparing to sell',
      body: `Your client is preparing their home at ${homeAddress} for sale. They've activated the Canopy Sale Prep checklist.`,
      category: 'agent',
      action_url: '/agent-portal',
    });
  } catch (e) {
    console.warn('Failed to send agent notification:', e);
  }

  // Mark that the agent was notified on the sale prep record
  const { error: updateError } = await supabase
    .from('home_sale_prep')
    .update({ agent_notified_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (updateError) console.warn('Failed to update agent_notified_at:', updateError);
}
