// ═══════════════════════════════════════════════════════════════
// Concierge Inquiries (formerly Pro+) — web mirror
// ═══════════════════════════════════════════════════════════════
// 2026-04-29: Pro+ tier killed. The "Pro+ services" name is now the
// umbrella brand for the curated add-on bundle. This service captures
// homeowner interest in the bundle (or specific add-ons like the
// Annual Certified Home Inspection) and admins/pros follow up out of
// band — there's no in-app subscription lifecycle anymore.
//
// Backed by the renamed `concierge_inquiries` table (was
// `pro_plus_inquiries`). RLS: owner reads own, anyone authed inserts,
// admins full access.
// ═══════════════════════════════════════════════════════════════

import { supabase, sendNotification } from '@/services/supabase';
import type { ConciergeInquiry, ConciergeInquiryStatus } from '@/types';

export interface SubmitInquiryParams {
  homeId?: string | null;
  email: string;
  /** Optional city/state hint for non-authed-or-no-home cases. */
  city?: string;
  state?: string;
  /** add_on_categories.id slugs the user is interested in (e.g., ['inspection']). */
  interestedCategories?: string[];
  notes?: string;
}

/** Capture an inquiry. Used by the "Ask about Pro+ services" CTA. */
export async function submitConciergeInquiry(p: SubmitInquiryParams): Promise<ConciergeInquiry> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('concierge_inquiries')
    .insert({
      user_id: user?.id ?? null,
      home_id: p.homeId ?? null,
      email: p.email,
      city: p.city ?? null,
      state: p.state ?? null,
      interested_categories: p.interestedCategories ?? [],
      notes: p.notes ?? null,
      status: 'new',
    })
    .select()
    .single();
  if (error) throw error;

  // Fire-and-forget admin pings — keep notification flow simple.
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
    if (admins) {
      const summary = (p.interestedCategories ?? []).join(', ') || 'general bundle';
      for (const admin of admins) {
        sendNotification({
          user_id: admin.id,
          title: 'New Pro+ services inquiry',
          body: `${p.email} expressed interest in ${summary}. Reach out via the admin inquiries view.`,
          category: 'pro_services',
          action_url: '/admin/users',
        }).catch(() => { /* non-blocking */ });
      }
    }
  } catch { /* non-blocking */ }

  return data as ConciergeInquiry;
}

/** Most recent open inquiry for the current user's home (if any). */
export async function getActiveInquiry(homeId: string): Promise<ConciergeInquiry | null> {
  const { data, error } = await supabase
    .from('concierge_inquiries')
    .select('*')
    .eq('home_id', homeId)
    .in('status', ['new', 'contacted', 'quoted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return (data ?? null) as ConciergeInquiry | null;
}

/** Convenience: list all inquiries for the current user. */
export async function listMyInquiries(): Promise<ConciergeInquiry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('concierge_inquiries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConciergeInquiry[];
}

/** Admin: update an inquiry's status as it moves through the pipeline. */
export async function updateInquiryStatus(
  inquiryId: string,
  status: ConciergeInquiryStatus,
  patch?: Partial<Pick<ConciergeInquiry, 'notes'>>,
): Promise<void> {
  const { error } = await supabase
    .from('concierge_inquiries')
    .update({
      status,
      contacted_at: status === 'contacted' ? new Date().toISOString() : undefined,
      ...(patch ?? {}),
    })
    .eq('id', inquiryId);
  if (error) throw error;
}

/** Admin: list all open inquiries. */
export async function listAllOpenInquiries(): Promise<ConciergeInquiry[]> {
  const { data, error } = await supabase
    .from('concierge_inquiries')
    .select('*')
    .in('status', ['new', 'contacted', 'quoted'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConciergeInquiry[];
}
