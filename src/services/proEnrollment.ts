import { supabase, sendNotification } from '@/services/supabase';

/**
 * Pro Enrollment Service
 *
 * Handles the lifecycle automation when a user upgrades to Pro:
 * 1. Find a provider matching their zip code
 * 2. Create the first visit allocation record
 * 3. Create the first bimonthly visit as 'proposed'
 * 4. Notify the matched provider about the new client
 * 5. Notify the homeowner about what to expect
 */

// ─── Get the current bimonthly visit month ───
// Bimonthly = Jan, Mar, May, Jul, Sep, Nov
// Returns YYYY-MM-01 format (date type in DB)
export function getCurrentBimonthlyMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Bimonthly months (1-indexed): 1, 3, 5, 7, 9, 11
  const monthNum = month + 1; // 1-indexed
  let bimonthlyMonth: number;
  if (monthNum % 2 === 1) {
    bimonthlyMonth = monthNum;
  } else {
    bimonthlyMonth = monthNum + 1;
    if (bimonthlyMonth > 12) {
      return `${year + 1}-01-01`;
    }
  }

  return `${year}-${String(bimonthlyMonth).padStart(2, '0')}-01`;
}

// ─── Get the next bimonthly month after the given one ───
// Accepts YYYY-MM-DD or YYYY-MM format, returns YYYY-MM-01
export function getNextBimonthlyMonth(currentMonth: string): string {
  const parts = currentMonth.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  let nextMonth = month + 2;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = nextMonth - 12;
    nextYear = year + 1;
  }
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

// ─── Check if a provider has a conflict on a given date ───
export async function hasProviderConflict(
  providerId: string,
  date: string
): Promise<boolean> {
  // Check bimonthly visits
  const { count: bimonthlyCount } = await supabase
    .from('pro_monthly_visits')
    .select('*', { count: 'exact', head: true })
    .eq('pro_provider_id', providerId)
    .in('status', ['proposed', 'confirmed', 'in_progress'])
    .or(`proposed_date.eq.${date},confirmed_date.eq.${date}`);

  if (bimonthlyCount && bimonthlyCount > 0) return true;

  // Check service appointments
  const { count: serviceCount } = await supabase
    .from('pro_service_appointments')
    .select('*', { count: 'exact', head: true })
    .eq('pro_provider_id', providerId)
    .eq('scheduled_date', date)
    .in('status', ['proposed', 'confirmed', 'scheduled', 'in_progress']);

  return (serviceCount || 0) > 0;
}

// ─── Find a conflict-free date for a provider ───
async function findOpenDate(providerId: string, startDate: Date): Promise<string> {
  let candidate = new Date(startDate);
  for (let i = 0; i < 14; i++) {
    // Skip weekends
    const day = candidate.getDay();
    if (day === 0) { candidate.setDate(candidate.getDate() + 1); continue; }
    if (day === 6) { candidate.setDate(candidate.getDate() + 2); continue; }

    const dateStr = candidate.toISOString().split('T')[0];
    const conflict = await hasProviderConflict(providerId, dateStr);
    if (!conflict) return dateStr;

    candidate.setDate(candidate.getDate() + 1);
  }
  // Fallback: just return the original date if no open slot in 2 weeks
  return startDate.toISOString().split('T')[0];
}

// ─── Find a provider for a given zip code ───
// Prefers Canopy Technicians for bimonthly visits; falls back to Partner Pros
export async function findProviderForZip(zipCode: string): Promise<{ id: string; user_id: string; business_name: string; contact_name: string; provider_type?: string } | null> {
  const { data: providers } = await supabase
    .from('pro_providers')
    .select('id, user_id, business_name, contact_name, zip_codes, is_available, provider_type')
    .eq('is_available', true);

  if (!providers || providers.length === 0) return null;

  // Find providers whose zip_codes array contains this zip
  const matching = providers.filter(p =>
    p.zip_codes && Array.isArray(p.zip_codes) && p.zip_codes.length > 0 && p.zip_codes.includes(zipCode)
  );

  if (matching.length > 0) {
    // Prefer canopy_technicians for bimonthly visits over partner_pros
    const technician = matching.find(p => p.provider_type === 'canopy_technician');
    if (technician) return technician;
    return matching[0];
  }

  // Fallback: if providers exist but have empty zip_codes, check service_areas
  // to see if this zip is in an active service area and assign the first available provider
  const providersWithEmptyZips = providers.filter(p =>
    !p.zip_codes || !Array.isArray(p.zip_codes) || p.zip_codes.length === 0
  );

  if (providersWithEmptyZips.length > 0) {
    const { data: serviceArea } = await supabase
      .from('service_areas')
      .select('zip_code')
      .eq('zip_code', zipCode)
      .eq('is_active', true)
      .single();

    if (serviceArea) {
      // Zip is in an active service area — assign the first available provider
      return providersWithEmptyZips[0];
    }
  }

  // No match — admin will need to manually assign
  return null;
}

// ─── Create a visit allocation for a homeowner ───
export async function createVisitAllocation(
  homeownerId: string,
  visitMonth: string,
  allocatedVisits: number = 1
): Promise<void> {
  // Check if allocation already exists
  const { data: existing } = await supabase
    .from('pro_visit_allocations')
    .select('id')
    .eq('homeowner_id', homeownerId)
    .eq('visit_month', visitMonth)
    .single();

  if (existing) return; // Already allocated

  const { error } = await supabase
    .from('pro_visit_allocations')
    .insert({
      homeowner_id: homeownerId,
      visit_month: visitMonth,
      allocated_visits: allocatedVisits,
      used_visits: 0,
      forfeited_visits: 0,
    });

  if (error) {
    console.error('Failed to create visit allocation:', error);
    // Non-blocking — don't throw
  }
}

// ─── Main enrollment function: called after upgrade ───
export async function enrollProSubscriber(userId: string): Promise<{
  provider: { id: string; business_name: string } | null;
  visitCreated: boolean;
  allocationCreated: boolean;
}> {
  const result = {
    provider: null as { id: string; business_name: string } | null,
    visitCreated: false,
    allocationCreated: false,
  };

  try {
    // 1. Get the user's home and zip code
    const { data: home } = await supabase
      .from('homes')
      .select('id, zip_code, address, city, state')
      .eq('user_id', userId)
      .single();

    if (!home) {
      console.warn('Pro enrollment: user has no home registered');
      return result;
    }

    // 2. Find a provider for their zip
    const provider = home.zip_code ? await findProviderForZip(home.zip_code) : null;
    if (provider) {
      result.provider = { id: provider.id, business_name: provider.business_name };
    }

    // 3. Create the first visit allocation
    const visitMonth = getCurrentBimonthlyMonth();
    try {
      await createVisitAllocation(userId, visitMonth);
      result.allocationCreated = true;
    } catch {
      // Non-blocking
    }

    // 4. Create the first bimonthly visit if we have a provider
    if (provider) {
      // Propose a date ~7 days from now, avoiding conflicts
      const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const proposedDateStr = await findOpenDate(provider.id, startDate);

      const { error: visitError } = await supabase
        .from('pro_monthly_visits')
        .insert({
          home_id: home.id,
          homeowner_id: userId,
          pro_provider_id: provider.id,
          visit_month: visitMonth,
          proposed_date: proposedDateStr,
          proposed_time_slot: '09:00-12:00',
          status: 'proposed',
          is_first_visit: true,
        });

      if (!visitError) {
        result.visitCreated = true;
      } else {
        console.warn('Failed to create first visit:', visitError);
      }

      // 5. Notify the provider about the new client
      if (provider.user_id) {
        sendNotification({
          user_id: provider.user_id,
          title: 'New Pro Client Assigned',
          body: `A new Pro subscriber at ${home.address}, ${home.city} has been assigned to you. Please review and confirm their first bimonthly visit.`,
          category: 'pro_service',
          action_url: '/pro-portal',
        }).catch(() => {});
      }
    }

    // 6. Notify the homeowner about their enrollment (full welcome with onboarding steps)
    // Detect actual tier from profile for correct welcome message
    const { data: userProfile } = await supabase.from('profiles').select('subscription_tier').eq('id', userId).single();
    const tierName = userProfile?.subscription_tier === 'pro_plus' ? 'Pro+' : 'Pro';
    sendNotification({
      user_id: userId,
      title: `Welcome to Canopy ${tierName}!`,
      body: provider
        ? `Welcome to Canopy ${tierName}! Here's what happens next:\n\n` +
          `1. Provider Assignment — Your Canopy pro (${provider.business_name || provider.contact_name}) has been assigned to your home.\n\n` +
          `2. First Visit — Your pro will schedule your first bimonthly home visit. This orientation visit is a thorough walkthrough (60-90 min) of all your home's systems.\n\n` +
          `3. Ongoing Care — After your first visit, you'll receive a maintenance visit every other month, covering seasonal tasks, filter changes, and inspections.\n\n` +
          `Got a leaky faucet or a noisy AC? Add notes on the Pro Services page before your visit so your technician knows what to check.`
        : `Welcome to Canopy ${tierName}! Here's what happens next:\n\n` +
          `1. Provider Assignment — We're matching you with a certified Canopy pro in your area. You'll be notified as soon as they're assigned.\n\n` +
          `2. First Visit — Your pro will schedule your first bimonthly home visit. This orientation visit is a thorough walkthrough (60-90 min) of all your home's systems.\n\n` +
          `3. Ongoing Care — After your first visit, you'll receive a maintenance visit every other month, covering seasonal tasks, filter changes, and inspections.\n\n` +
          `Got a leaky faucet or a noisy AC? Add notes on the Pro Services page before your visit so your technician knows what to check.`,
      category: 'pro_service',
      action_url: '/pro-services',
    }).catch(() => {});

    // Mark welcome email as sent so the daily cron doesn't send a duplicate
    Promise.resolve(supabase.from('profiles').update({ pro_welcome_sent: true }).eq('id', userId)).catch(() => {});

  } catch (error) {
    console.error('Pro enrollment error:', error);
  }

  return result;
}

// ─── Auto-propose next visit after completion ───
export async function proposeNextVisit(
  completedVisitId: string
): Promise<{ nextVisitId: string | null }> {
  try {
    // Load the completed visit
    const { data: visit } = await supabase
      .from('pro_monthly_visits')
      .select('*')
      .eq('id', completedVisitId)
      .single();

    if (!visit) return { nextVisitId: null };

    // Calculate next bimonthly month
    const nextMonth = getNextBimonthlyMonth(visit.visit_month);

    // Check if a visit already exists for this homeowner in the next month
    const { data: existing } = await supabase
      .from('pro_monthly_visits')
      .select('id')
      .eq('homeowner_id', visit.homeowner_id)
      .eq('visit_month', nextMonth)
      .single();

    if (existing) return { nextVisitId: existing.id };

    // Create the allocation for the next month
    await createVisitAllocation(visit.homeowner_id, nextMonth);

    // Propose a date ~2 months from the completed visit date, avoiding conflicts
    const completedDate = new Date(visit.completed_at || visit.confirmed_date || visit.proposed_date);
    const targetDate = new Date(completedDate);
    targetDate.setMonth(targetDate.getMonth() + 2);
    const nextDateStr = await findOpenDate(visit.pro_provider_id, targetDate);

    const { data: newVisit, error } = await supabase
      .from('pro_monthly_visits')
      .insert({
        home_id: visit.home_id,
        homeowner_id: visit.homeowner_id,
        pro_provider_id: visit.pro_provider_id,
        visit_month: nextMonth,
        proposed_date: nextDateStr,
        proposed_time_slot: visit.confirmed_start_time || visit.proposed_time_slot || '09:00-12:00',
        status: 'proposed',
      })
      .select('id')
      .single();

    if (error) {
      console.warn('Failed to auto-propose next visit:', error);
      return { nextVisitId: null };
    }

    // Notify the homeowner about the next proposed visit
    const monthLabel = new Date(nextMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    sendNotification({
      user_id: visit.homeowner_id,
      title: 'Next Visit Proposed',
      body: `Your ${monthLabel} bimonthly visit has been proposed for ${new Date(nextDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Visit Pro Services to review and add notes for your technician.`,
      category: 'pro_service',
      action_url: '/pro-services',
    }).catch(() => {});

    return { nextVisitId: newVisit?.id || null };
  } catch (error) {
    console.error('Error auto-proposing next visit:', error);
    return { nextVisitId: null };
  }
}
