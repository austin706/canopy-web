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
  currentItems: string[],
  totalItems = 40
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

  // Notify agent at milestones (25%, 50%, 75%, 100%)
  if (completed && totalItems > 0) {
    const prevPct = Math.floor((currentItems.length / totalItems) * 100);
    const newPct = Math.floor((newItems.length / totalItems) * 100);
    const milestones = [25, 50, 75, 100];
    const hitMilestone = milestones.find(m => prevPct < m && newPct >= m);

    if (hitMilestone) {
      try {
        const { data: prep } = await supabase.from('home_sale_prep').select('home_id').eq('id', prepId).single();
        if (prep?.home_id) {
          const { data: home } = await supabase.from('homes').select('user_id, address, city, agent_id').eq('id', prep.home_id).single();
          if (home?.agent_id) {
            // Resolve agent's user_id for in-app notification
            const { data: agent } = await supabase.from('agents').select('user_id, email, name').eq('id', home.agent_id).single();
            const { data: owner } = await supabase.from('profiles').select('full_name, email').eq('id', home.user_id).single();
            const ownerName = owner?.full_name || owner?.email || 'Your client';
            const addr = `${home.address}, ${home.city}`;
            const msg = hitMilestone === 100
              ? `${ownerName} has completed all sale prep items for ${addr}. The home is ready to list!`
              : `${ownerName} is ${hitMilestone}% through their sale prep checklist for ${addr} (${newItems.length}/${totalItems} items done).`;

            if (agent?.user_id) {
              sendNotification({
                user_id: agent.user_id,
                title: hitMilestone === 100 ? 'Sale Prep Complete!' : `Sale Prep ${hitMilestone}% Done`,
                body: msg,
                category: 'agent',
                action_url: '/agent-portal',
              }).catch(() => {});
            } else if (agent?.email) {
              supabase.functions.invoke('send-notifications', {
                body: {
                  direct_email: true,
                  recipient_email: agent.email,
                  subject: hitMilestone === 100 ? 'Sale Prep Complete!' : `Sale Prep ${hitMilestone}% Done`,
                  title: hitMilestone === 100 ? 'Sale Prep Complete!' : `Sale Prep ${hitMilestone}% Done`,
                  body: msg,
                  action_url: 'https://canopyhome.app/agent-portal',
                  action_label: 'View in Canopy',
                },
              }).catch(() => {});
            }
          }
        }
      } catch (e) { console.warn('Failed to send sale prep milestone notification:', e); }
    }
  }

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
  let notifyUserId: string | null = null;
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
    console.error('Agent notification: could not resolve profile ID for agent', agentId);
  }

  // Send notification via edge function (in-app + email + push)
  if (notifyUserId) {
    try {
      await sendNotification({
        user_id: notifyUserId,
        title: 'Client preparing to sell',
        body: `Your client is preparing their home at ${homeAddress} for sale. They've activated the Canopy Sale Prep checklist. Log in to Canopy to see their progress and the home's full record.`,
        category: 'agent',
        action_url: '/agent-portal',
      });
    } catch (e) {
      console.warn('Failed to send agent notification via sendNotification:', e);
    }
  } else {
    // Fallback: send direct email to agent even if we couldn't resolve their profile ID
    // This ensures agents without Canopy accounts still get notified
    try {
      const { data: agentFallback } = await supabase
        .from('agents')
        .select('email, name')
        .eq('id', agentId)
        .single();
      if (agentFallback?.email) {
        await supabase.functions.invoke('send-notifications', {
          body: {
            direct_email: true,
            recipient_email: agentFallback.email,
            subject: 'Your client is preparing to sell',
            title: 'Client Preparing to Sell',
            body: `Your client is preparing their home at ${homeAddress} for sale. They've activated the Canopy Sale Prep checklist.\n\nLog in to Canopy to see their progress, the home's full maintenance record, equipment inventory, and inspection history.`,
            action_url: 'https://canopyhome.app/agent-portal',
            action_label: 'View in Canopy',
          },
        });
      } else {
        console.warn('Agent notification fallback: no email found for agent', agentId);
      }
    } catch (e) {
      console.warn('Failed to send agent fallback email:', e);
    }
  }

  // Mark that the agent was notified on the sale prep record
  const { error: updateError } = await supabase
    .from('home_sale_prep')
    .update({ agent_notified_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (updateError) console.warn('Failed to update agent_notified_at:', updateError);
}
