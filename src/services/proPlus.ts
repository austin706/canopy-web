import { supabase, sendNotification, sendDirectEmailNotification } from '@/services/supabase';
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

  // Get homeowner and provider info for notifications
  const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single();
  const { data: home } = await supabase.from('homes').select('address, city').eq('id', homeId).single();
  const { data: provider } = await supabase.from('pro_providers').select('user_id, business_name, contact_name').eq('id', providerId).single();
  const homeLabel = home ? `${home.address}, ${home.city}` : 'their home';
  const userName = profile?.full_name || 'A homeowner';

  // Notify the provider about the consultation request
  if (provider?.user_id) {
    sendNotification({
      user_id: provider.user_id,
      title: 'New Pro+ Consultation Request',
      body: `${userName} at ${homeLabel} has requested a Pro+ consultation. Please review and schedule an in-home assessment.`,
      category: 'pro_plus',
      action_url: '/pro-portal',
    }).catch(() => {});
  }

  // Notify admins
  const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
  if (admins) {
    for (const admin of admins) {
      sendNotification({
        user_id: admin.id,
        title: 'New Pro+ Consultation Request',
        body: `${userName} has requested a Pro+ consultation for ${homeLabel}. Provider: ${provider?.business_name || 'Unassigned'}.`,
        category: 'pro_plus',
        action_url: '/admin/users',
      }).catch(() => {});
    }
  }

  // Confirm to the homeowner
  sendNotification({
    user_id: user.id,
    title: 'Pro+ Consultation Requested',
    body: `Your Pro+ consultation request has been submitted! ${provider?.business_name || 'Your Canopy pro'} will reach out to schedule an in-home assessment where they'll evaluate your property and build a custom maintenance plan.`,
    category: 'pro_plus',
    action_url: '/pro-plus',
  }).catch(() => {});

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

  // Notify the provider that quote was approved
  if (sub.pro_provider_id) {
    const { data: provider } = await supabase.from('pro_providers').select('user_id, business_name').eq('id', sub.pro_provider_id).single();
    const { data: homeowner } = await supabase.from('profiles').select('full_name').eq('id', sub.homeowner_id).single();
    if (provider?.user_id) {
      sendNotification({
        user_id: provider.user_id,
        title: 'Pro+ Quote Approved',
        body: `${homeowner?.full_name || 'Your client'} has approved the Pro+ quote at $${sub.quoted_monthly_rate}/mo. Their subscription is now active.`,
        category: 'pro_plus',
        action_url: '/pro-portal',
      }).catch(() => {});
    }
  }

  // Notify the homeowner — welcome to Pro+
  sendNotification({
    user_id: sub.homeowner_id,
    title: 'Welcome to Canopy Pro+!',
    body: `Your Pro+ subscription is now active at $${sub.quoted_monthly_rate}/mo. Your Canopy pro will handle all routine maintenance — filter changes, seasonal inspections, gutter cleaning, and more. Larger projects will be quoted separately. Visit Pro Services to see your upcoming schedule.`,
    category: 'pro_plus',
    action_url: '/pro-services',
  }).catch(() => {});

  // Update tier on profile
  await supabase.from('profiles').update({ subscription_tier: 'pro_plus' }).eq('id', sub.homeowner_id);
}

export async function cancelProPlus(subscriptionId: string): Promise<void> {
  const { data: sub } = await supabase
    .from('pro_plus_subscriptions')
    .select('homeowner_id, pro_provider_id')
    .eq('id', subscriptionId)
    .single();

  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);
  if (error) throw error;

  if (sub) {
    // Notify homeowner
    sendNotification({
      user_id: sub.homeowner_id,
      title: 'Pro+ Subscription Cancelled',
      body: 'Your Pro+ subscription has been cancelled. You can still access your home data and maintenance history. If you change your mind, you can re-enroll anytime from Settings.',
      category: 'pro_plus',
      action_url: '/subscription',
    }).catch(() => {});

    // Notify provider
    if (sub.pro_provider_id) {
      const { data: provider } = await supabase.from('pro_providers').select('user_id').eq('id', sub.pro_provider_id).single();
      const { data: homeowner } = await supabase.from('profiles').select('full_name').eq('id', sub.homeowner_id).single();
      if (provider?.user_id) {
        sendNotification({
          user_id: provider.user_id,
          title: 'Pro+ Client Cancelled',
          body: `${homeowner?.full_name || 'A client'} has cancelled their Pro+ subscription.`,
          category: 'pro_plus',
          action_url: '/pro-portal',
        }).catch(() => {});
      }
    }
  }
}

export async function pauseProPlus(subscriptionId: string): Promise<void> {
  const { data: sub } = await supabase
    .from('pro_plus_subscriptions')
    .select('homeowner_id, pro_provider_id')
    .eq('id', subscriptionId)
    .single();

  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({ status: 'paused' })
    .eq('id', subscriptionId);
  if (error) throw error;

  if (sub) {
    sendNotification({
      user_id: sub.homeowner_id,
      title: 'Pro+ Subscription Paused',
      body: 'Your Pro+ subscription is paused. No visits will be scheduled and billing is on hold. You can resume anytime from your Pro+ management page.',
      category: 'pro_plus',
      action_url: '/pro-plus',
    }).catch(() => {});

    if (sub.pro_provider_id) {
      const { data: provider } = await supabase.from('pro_providers').select('user_id').eq('id', sub.pro_provider_id).single();
      const { data: homeowner } = await supabase.from('profiles').select('full_name').eq('id', sub.homeowner_id).single();
      if (provider?.user_id) {
        sendNotification({
          user_id: provider.user_id,
          title: 'Pro+ Client Paused',
          body: `${homeowner?.full_name || 'A client'} has paused their Pro+ subscription. No visits should be scheduled until they resume.`,
          category: 'pro_plus',
          action_url: '/pro-portal',
        }).catch(() => {});
      }
    }
  }
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
  const { data: sub } = await supabase
    .from('pro_plus_subscriptions')
    .select('homeowner_id, pro_provider_id')
    .eq('id', subscriptionId)
    .single();

  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({
      status: 'consultation_scheduled',
      consultation_scheduled_date: date,
    })
    .eq('id', subscriptionId);
  if (error) throw error;

  if (sub) {
    const { data: provider } = await supabase.from('pro_providers').select('business_name, contact_name').eq('id', sub.pro_provider_id).single();
    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    sendNotification({
      user_id: sub.homeowner_id,
      title: 'Pro+ Consultation Scheduled',
      body: `Your Pro+ consultation with ${provider?.business_name || provider?.contact_name || 'your Canopy pro'} is scheduled for ${formattedDate}. They'll walk through your home to assess all systems and build your custom maintenance plan.`,
      category: 'pro_plus',
      action_url: '/pro-plus',
    }).catch(() => {});
  }
}

export async function completeConsultation(subscriptionId: string, notes: string): Promise<void> {
  const { data: sub } = await supabase
    .from('pro_plus_subscriptions')
    .select('homeowner_id, pro_provider_id')
    .eq('id', subscriptionId)
    .single();

  const { error } = await supabase
    .from('pro_plus_subscriptions')
    .update({
      status: 'consultation_completed',
      consultation_completed_at: new Date().toISOString(),
      consultation_notes: notes,
    })
    .eq('id', subscriptionId);
  if (error) throw error;

  if (sub) {
    sendNotification({
      user_id: sub.homeowner_id,
      title: 'Pro+ Consultation Complete',
      body: 'Your in-home consultation is complete! Your Canopy pro is now preparing a custom quote for your Pro+ maintenance plan. You\'ll be notified as soon as it\'s ready for review.',
      category: 'pro_plus',
      action_url: '/pro-plus',
    }).catch(() => {});
  }
}

export async function submitQuote(subscriptionId: string, monthlyRate: number, validUntil: string, coverageNotes: string): Promise<void> {
  const { data: sub } = await supabase
    .from('pro_plus_subscriptions')
    .select('homeowner_id, pro_provider_id')
    .eq('id', subscriptionId)
    .single();

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

  if (sub) {
    const { data: provider } = await supabase.from('pro_providers').select('business_name, contact_name').eq('id', sub.pro_provider_id).single();
    const validDate = new Date(validUntil + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    sendNotification({
      user_id: sub.homeowner_id,
      title: 'Your Pro+ Quote Is Ready',
      body: `${provider?.business_name || 'Your Canopy pro'} has prepared your Pro+ quote: $${monthlyRate}/mo for comprehensive home maintenance. This covers: ${coverageNotes.slice(0, 150)}${coverageNotes.length > 150 ? '...' : ''}. Quote valid until ${validDate}. Review and approve to get started.`,
      category: 'pro_plus',
      action_url: '/pro-plus',
    }).catch(() => {});
  }
}
