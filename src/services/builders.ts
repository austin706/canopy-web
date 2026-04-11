// ===============================================================
// Builders Domain
// ===============================================================
import { supabase } from './supabaseClient';
import logger from '@/utils/logger';
import { sendDirectEmailNotification } from './notifications';

export interface BuilderApplication {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  company_name: string;
  website?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  years_in_business?: number | null;
  annual_home_volume?: number | null;
  service_area_zips?: string[];
  primary_markets?: string | null;
  home_types?: string[];
  price_range?: string | null;
  bio?: string | null;
  logo_url?: string | null;
  referral_source?: string | null;
  agreed_to_terms: boolean;
  agreed_to_terms_at?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Builder {
  id: string;
  application_id?: string | null;
  company_name: string;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  service_area_zips?: string[];
  primary_markets?: string | null;
  home_types?: string[];
  price_range?: string | null;
  annual_home_volume?: number | null;
  bio?: string | null;
  logo_url?: string | null;
  slug?: string | null;
  status: 'active' | 'paused' | 'offboarded';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

function slugifyCompany(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'builder'}-${suffix}`;
}

export const submitBuilderApplication = async (
  app: Partial<BuilderApplication>,
): Promise<BuilderApplication> => {
  const { data, error } = await supabase
    .from('builder_applications')
    .insert(app)
    .select()
    .single();
  if (error) throw error;
  return data as BuilderApplication;
};

export const getBuilderApplications = async (
  status?: string,
): Promise<BuilderApplication[]> => {
  let query = supabase
    .from('builder_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as BuilderApplication[];
};

export const getBuilderApplicationById = async (
  id: string,
): Promise<BuilderApplication> => {
  const { data, error } = await supabase
    .from('builder_applications')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as BuilderApplication;
};

export const reviewBuilderApplication = async (
  id: string,
  decision: 'approved' | 'rejected',
  reviewedBy: string,
  notes?: string,
): Promise<void> => {
  const app = await getBuilderApplicationById(id);

  if (decision === 'approved') {
    const { error: createErr } = await supabase
      .from('builders')
      .insert({
        application_id: id,
        company_name: app.company_name,
        contact_name: app.full_name,
        email: app.email,
        phone: app.phone || null,
        website: app.website || null,
        license_number: app.license_number || null,
        license_state: app.license_state || null,
        service_area_zips: app.service_area_zips || [],
        primary_markets: app.primary_markets || null,
        home_types: app.home_types || [],
        price_range: app.price_range || null,
        annual_home_volume: app.annual_home_volume || null,
        bio: app.bio || null,
        logo_url: app.logo_url || null,
        slug: slugifyCompany(app.company_name),
        status: 'active',
      });
    if (createErr) throw createErr;

    const { error: updateErr } = await supabase
      .from('builder_applications')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateErr) throw updateErr;

    try {
      await sendDirectEmailNotification({
        recipient_email: app.email,
        title: 'Welcome to Canopy Builder Partner Program',
        body: `Your Canopy Builder Partner application has been approved. You can now enroll new-construction homes into Canopy at closing.\n\nWe'll follow up with onboarding details.`,
        subject: 'Application Approved - Canopy Builder Partner',
        category: 'builder_application',
      });
    } catch (emailErr) {
      logger.error('Failed to send builder approval email:', emailErr);
    }
  } else {
    const { error: updateErr } = await supabase
      .from('builder_applications')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateErr) throw updateErr;

    try {
      await sendDirectEmailNotification({
        recipient_email: app.email,
        title: 'Application Status Update',
        body: `Thank you for your interest in the Canopy Builder Partner program. Unfortunately, your application was not approved at this time.\n\n${notes ? `Feedback: ${notes}\n\n` : ''}We encourage you to reapply if circumstances change.`,
        subject: 'Application Decision - Canopy Builder Partner',
        category: 'builder_application',
      });
    } catch (emailErr) {
      logger.error('Failed to send builder rejection email:', emailErr);
    }
  }
};

export const getBuilders = async (): Promise<Builder[]> => {
  const { data, error } = await supabase
    .from('builders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Builder[];
};

export const getBuilderBySlug = async (slug: string): Promise<Builder | null> => {
  const { data, error } = await supabase
    .from('builders')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return (data as Builder) || null;
};


