// ===============================================================
// agents_qr Domain
// ===============================================================
import { supabase } from './supabaseClient';
import { verifyAgentOwnership } from './agents';
import { sendDirectEmailNotification } from './notifications';
import { BuilderApplication, Builder } from './builders';
import logger from '@/utils/logger';



export interface AgentHomeQRCode {
  id: string;
  agent_id: string;
  home_id: string | null;
  qr_token: string;
  gift_code_id: string | null;
  status: 'active' | 'claimed' | 'expired' | 'revoked';
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  notes: string | null;
  home_data: Record<string, unknown> | null;
  buyer_name: string | null;
  buyer_email: string | null;
  created_at: string;
  updated_at: string;
}

export const createAgentQRCode = async (
  agentId: string,
  homeData: Record<string, unknown>,
  buyerName?: string,
  buyerEmail?: string,
  notes?: string,
): Promise<AgentHomeQRCode> => {
  await verifyAgentOwnership(agentId);
  const { data, error } = await supabase
    .from('agent_home_qr_codes')
    .insert({
      agent_id: agentId,
      home_data: homeData,
      buyer_name: buyerName || null,
      buyer_email: buyerEmail || null,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAgentQRCodes = async (agentId: string): Promise<AgentHomeQRCode[]> => {
  // Security: Verify agent ownership before retrieving QR codes
  await verifyAgentOwnership(agentId);

  const { data, error } = await supabase
    .from('agent_home_qr_codes')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getQRCodeByToken = async (token: string): Promise<AgentHomeQRCode | null> => {
  const { data, error } = await supabase
    .from('agent_home_qr_codes')
    .select('*')
    .eq('qr_token', token)
    .eq('status', 'active')
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data;
};

/**
 * Atomically claim an agent-issued QR code.
 *
 * P1 #20 (2026-04-23): The agent QR claim flow used to flip
 * `status='claimed'` on the QR row but never materialized a `homes`
 * record from `home_data`, leaving the buyer with an empty dashboard.
 * It also bypassed the `home_transfers` audit trail used by the
 * owner-to-owner Home Transfer flow, so consumers had to query two
 * tables to reconstruct ownership history.
 *
 * The RPC `claim_agent_qr_code(p_qr_token, p_user_id)` now:
 *   1. Validates the QR is active + not expired (locks the row)
 *   2. Creates a `homes` record from the JSONB `home_data` payload
 *      with `user_id = p_user_id`
 *   3. Updates the QR row: status='claimed', claimed_by, home_id
 * All steps succeed or all roll back together.
 *
 * Returns the newly created home's UUID so the client can route the
 * user straight into it.
 */
export const claimQRCode = async (token: string, userId: string): Promise<{ homeId: string }> => {
  const { data, error } = await supabase.rpc('claim_agent_qr_code', {
    p_qr_token: token,
    p_user_id: userId,
  });
  if (error) {
    logger.error('claim_agent_qr_code RPC failed:', error);
    throw new Error(error.message || 'Failed to claim home. Please try again.');
  }
  if (!data) throw new Error('Claim succeeded but no home was returned. Please refresh.');
  return { homeId: data as string };
};

export const revokeQRCode = async (id: string): Promise<void> => {
  // Security: Verify the QR code belongs to the current user's agent before revoking
  const { data: qrCode, error: fetchErr } = await supabase
    .from('agent_home_qr_codes')
    .select('agent_id')
    .eq('id', id)
    .single();

  if (fetchErr || !qrCode) throw new Error('QR code not found');

  // Verify ownership of the associated agent
  await verifyAgentOwnership(qrCode.agent_id);

  const { error } = await supabase
    .from('agent_home_qr_codes')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

// ─── Technician Documents ───

export interface AgentApplication {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  brokerage?: string;
  license_number?: string;
  license_state?: string;
  years_experience?: number;
  bio?: string;
  service_area_zips?: string[];
  photo_url?: string;
  referral_source?: string;
  agreed_to_terms: boolean;
  agreed_to_terms_at?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
}

export const submitAgentApplication = async (app: Partial<AgentApplication>): Promise<AgentApplication> => {
  const { data, error } = await supabase
    .from('agent_applications')
    .insert(app)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAgentApplications = async (status?: string): Promise<AgentApplication[]> => {
  let query = supabase
    .from('agent_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getAgentApplicationById = async (id: string): Promise<AgentApplication> => {
  const { data, error } = await supabase
    .from('agent_applications')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const reviewAgentApplication = async (
  id: string,
  decision: 'approved' | 'rejected',
  reviewedBy: string,
  notes?: string
): Promise<void> => {
  // First get the application data
  const app = await getAgentApplicationById(id);

  if (decision === 'approved') {
    // Create agent record from application
    const { data: agent, error: createErr } = await supabase
      .from('agents')
      .insert({
        id: crypto.randomUUID(),
        name: app.full_name,
        email: app.email,
        phone: app.phone || null,
        brokerage: app.brokerage || null,
        license_number: app.license_number || null,
        license_state: app.license_state || null,
        years_experience: app.years_experience || null,
        bio: app.bio || null,
        service_area_zips: app.service_area_zips || [],
        photo_url: app.photo_url || null,
        application_id: id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createErr) throw createErr;

    // Update application to approved and link agent
    const { error: updateErr } = await supabase
      .from('agent_applications')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Send approval email
    try {
      await sendDirectEmailNotification({
        recipient_email: app.email,
        title: 'Welcome to Canopy Agent Partner Program',
        body: `Congratulations! Your application has been approved. You are now a Canopy Agent Partner and can start creating gift codes for your clients.\n\nSign in at canopyhome.app/agent-portal to get started.`,
        subject: 'Application Approved - Canopy Agent Partner',
        category: 'agent_application',
        action_url: '/agent-portal',
        action_label: 'Access Agent Portal',
      });
    } catch (emailErr) {
      logger.error('Failed to send approval email:', emailErr);
    }
  } else {
    // Rejection
    const { error: updateErr } = await supabase
      .from('agent_applications')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Send rejection email
    try {
      await sendDirectEmailNotification({
        recipient_email: app.email,
        title: 'Application Status Update',
        body: `Thank you for your interest in becoming a Canopy Agent Partner. Unfortunately, your application was not approved at this time.\n\n${notes ? `Feedback: ${notes}\n\n` : ''}We encourage you to reapply if circumstances change.`,
        subject: 'Application Decision - Canopy Agent Partner',
        category: 'agent_application',
      });
    } catch (emailErr) {
      logger.error('Failed to send rejection email:', emailErr);
    }
  }
};

// Builder Applications are handled in builders.ts module
