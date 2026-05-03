import { supabase, sendNotification, sendDirectEmailNotification } from '@/services/supabase';
import logger from '@/utils/logger';

export interface HomeTransfer {
  id: string;
  home_id: string;
  from_user_id: string;
  to_email: string;
  to_user_id?: string;
  transfer_token?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  initiated_at: string;
  accepted_at?: string;
  declined_at?: string;
  expires_at?: string;
  agent_attested_at?: string;
  agent_attestation_note?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/** Get active (pending) transfer for a home */
export async function getActiveTransfer(homeId: string): Promise<HomeTransfer | null> {
  const { data, error } = await supabase
    .from('home_transfers')
    .select('*')
    .eq('home_id', homeId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Get pending transfers sent TO the current user (by email) */
export async function getIncomingTransfers(email: string): Promise<HomeTransfer[]> {
  const { data, error } = await supabase
    .from('home_transfers')
    .select('*')
    .eq('to_email', email.toLowerCase())
    .eq('status', 'pending')
    .order('initiated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Initiate a home transfer to a buyer */
export async function initiateTransfer(
  homeId: string,
  fromUserId: string,
  toEmail: string,
  notes?: string
): Promise<HomeTransfer> {
  const { data, error } = await supabase
    .from('home_transfers')
    .insert({
      home_id: homeId,
      from_user_id: fromUserId,
      to_email: toEmail.toLowerCase(),
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Accept a transfer — re-parent the home and all data to the new owner */
export async function acceptTransfer(transferId: string, newOwnerId: string): Promise<void> {
  // Fetch transfer details before the atomic operation (for notifications)
  const { data: transfer, error: fetchErr } = await supabase
    .from('home_transfers')
    .select('*')
    .eq('id', transferId)
    .single();
  if (fetchErr || !transfer) throw fetchErr || new Error('Transfer not found');

  if (transfer.status !== 'pending') {
    throw new Error('This transfer is no longer active');
  }

  // P1-16 (2026-04-23): server stores `expires_at` but accept never enforced it.
  // A buyer could redeem a stale token weeks after the seller's intent window
  // closed. Block accept once expired and mark the row so it doesn't keep
  // surfacing on the buyer's incoming list.
  if (transfer.expires_at && new Date(transfer.expires_at).getTime() < Date.now()) {
    try {
      await supabase
        .from('home_transfers')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', transferId);
    } catch (e) {
      logger.warn('Failed to mark transfer expired:', e);
    }
    throw new Error('This transfer has expired. Ask the seller to send a new one.');
  }

  // Use atomic database function — re-parents home, clears secure notes,
  // clears vault PIN, and marks transfer accepted in a single transaction.
  const { error: rpcErr } = await supabase.rpc('accept_home_transfer', {
    p_transfer_id: transferId,
    p_new_owner_id: newOwnerId,
  });
  if (rpcErr) {
    logger.error('Atomic transfer failed:', rpcErr);
    throw new Error(rpcErr.message || 'Home transfer failed. Please try again or contact support.');
  }

  // Notify the seller (non-critical — runs after the atomic transfer succeeds)
  try {
    const fromUserId = transfer.from_user_id;
    if (fromUserId) {
      const { data: buyer } = await supabase.from('profiles').select('full_name, email').eq('id', newOwnerId).single();
      const { data: home } = await supabase.from('homes').select('address, city').eq('id', transfer.home_id).single();
      const buyerName = buyer?.full_name || buyer?.email || 'The new owner';
      const addr = home ? `${home.address}, ${home.city}` : 'your home';
      sendNotification({
        user_id: fromUserId,
        title: 'Home Transfer Accepted',
        body: `${buyerName} has accepted the transfer of ${addr}. The home record and all associated data have been transferred to the new owner.`,
        category: 'general',
        action_url: '/dashboard',
      }).catch(() => {});
    }
  } catch (e) { logger.warn('Failed to send transfer accepted notification:', e); }
}

/** Decline a transfer */
export async function declineTransfer(transferId: string): Promise<void> {
  // Fetch transfer details before updating for notification
  const { data: transfer } = await supabase.from('home_transfers').select('from_user_id, home_id, to_email').eq('id', transferId).single();

  const { error } = await supabase
    .from('home_transfers')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId);
  if (error) throw error;

  // Notify the seller that the transfer was declined
  if (transfer?.from_user_id) {
    try {
      const { data: home } = await supabase.from('homes').select('address, city').eq('id', transfer.home_id).single();
      const addr = home ? `${home.address}, ${home.city}` : 'your home';
      sendNotification({
        user_id: transfer.from_user_id,
        title: 'Home Transfer Declined',
        body: `The transfer of ${addr} to ${transfer.to_email || 'the recipient'} has been declined. You can initiate a new transfer from the Home Transfer page if needed.`,
        category: 'general',
        action_url: '/home-transfer',
      }).catch(() => {});
    } catch (e) { logger.warn('Failed to send transfer declined notification:', e); }
  }
}

/** Cancel a pending transfer (by the seller) */
export async function cancelTransfer(transferId: string): Promise<void> {
  // Get transfer details before cancelling (need to_user_id/to_email for notification)
  const { data: transfer } = await supabase
    .from('home_transfers')
    .select('to_user_id, to_email, home_id')
    .eq('id', transferId)
    .single();

  const { error } = await supabase
    .from('home_transfers')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId);
  if (error) throw error;

  // Notify the buyer that the transfer was cancelled
  if (transfer) {
    try {
      const { data: home } = await supabase.from('homes').select('address, city').eq('id', transfer.home_id).single();
      const addr = home ? `${home.address}, ${home.city}` : 'a home';
      if (transfer.to_user_id) {
        sendNotification({
          user_id: transfer.to_user_id,
          title: 'Transfer Cancelled',
          body: `The home record transfer for ${addr} has been cancelled by the seller.`,
          category: 'general',
          action_url: '/dashboard',
        }).catch(() => {});
      } else if (transfer.to_email) {
        sendDirectEmailNotification({
          recipient_email: transfer.to_email,
          title: 'Transfer Cancelled',
          body: `The home record transfer for ${addr} has been cancelled by the seller.`,
          category: 'general',
        }).catch(() => {});
      }
    } catch (e) { logger.warn('Failed to send cancel notification:', e); }
  }
}

/** Notify the buyer via in-app notification + the existing email system */
export async function notifyBuyerOfTransfer(
  toEmail: string,
  fromUserName: string,
  homeAddress: string,
  transferToken: string
): Promise<void> {
  // Check if buyer already has a Canopy account
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', toEmail.toLowerCase())
    .maybeSingle();

  if (existingUser) {
    // Send notification via edge function (in-app + email + push)
    await sendNotification({
      user_id: existingUser.id,
      title: 'Home Record Transfer',
      body: `${fromUserName} wants to transfer their home record at ${homeAddress} to you. This includes the full maintenance history, equipment inventory, and inspection reports.`,
      category: 'general',
      action_url: `/transfer/accept?token=${transferToken}`,
    });
  } else {
    // Buyer doesn't have a Canopy account — save email-only notification to DB
    // process-queue cron will pick it up and send via Resend
    const acceptUrl = `https://canopyhome.app/transfer/accept?token=${transferToken}&email=${encodeURIComponent(toEmail.toLowerCase())}`;
    try {
      await sendDirectEmailNotification({
        recipient_email: toEmail.toLowerCase(),
        subject: `${fromUserName} wants to transfer a home record to you`,
        title: 'Home Record Transfer',
        body: `${fromUserName} wants to transfer their home record at ${homeAddress} to you on Canopy Home. This includes the full maintenance history, equipment inventory, and inspection reports.\n\nCanopy is a free home management app that helps you track maintenance, equipment, and more. Create your free account to accept this transfer.`,
        action_url: acceptUrl,
        action_label: 'Accept Transfer',
        category: 'general',
      });
    } catch (e) {
      logger.warn('Failed to save transfer email notification:', e);
    }
  }
}

/** Record an edit to a maintenance log entry */
export async function trackLogEdit(
  logId: string,
  editedBy: string,
  fieldChanged: string,
  oldValue: string | null,
  newValue: string | null
): Promise<void> {
  const { error } = await supabase
    .from('maintenance_log_edits')
    .insert({
      log_id: logId,
      edited_by: editedBy,
      field_changed: fieldChanged,
      old_value: oldValue,
      new_value: newValue,
    });
  if (error) logger.warn('Failed to track edit:', error);
}

/** Get edit history for a maintenance log entry */
export async function getLogEditHistory(logId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('maintenance_log_edits')
    .select('*')
    .eq('log_id', logId)
    .order('edited_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Agent attests to the accuracy of a home's record */
export async function attestHomeRecord(
  homeId: string,
  note?: string
): Promise<void> {
  const { error } = await supabase
    .from('homes')
    .update({
      agent_attested_at: new Date().toISOString(),
      agent_attestation_note: note || null,
    })
    .eq('id', homeId);
  if (error) throw error;
}

/** Calculate and store record completeness score */
export async function calculateCompletenessScore(homeId: string): Promise<number> {
  let score = 0;
  const maxScore = 100;

  // Check home profile completeness (25 pts)
  const { data: home } = await supabase.from('homes').select('*').eq('id', homeId).single();
  if (home) {
    const profileFields = ['year_built', 'square_footage', 'roof_type', 'foundation_type', 'heating_type', 'cooling_type', 'photo_url'];
    const filledProfile = profileFields.filter(f => home[f]).length;
    score += Math.round((filledProfile / profileFields.length) * 25);
  }

  // Check equipment inventory (20 pts)
  const { count: eqCount } = await supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('home_id', homeId);
  if (eqCount && eqCount >= 5) score += 20;
  else if (eqCount && eqCount >= 2) score += 12;
  else if (eqCount && eqCount >= 1) score += 6;

  // Check maintenance logs (20 pts)
  const { count: logCount } = await supabase.from('maintenance_logs').select('*', { count: 'exact', head: true }).eq('home_id', homeId);
  if (logCount && logCount >= 10) score += 20;
  else if (logCount && logCount >= 5) score += 14;
  else if (logCount && logCount >= 1) score += 7;

  // Check pro visits (15 pts)
  const { count: visitCount } = await supabase
    .from('pro_monthly_visits')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .eq('status', 'completed');
  if (visitCount && visitCount >= 3) score += 15;
  else if (visitCount && visitCount >= 1) score += 10;

  // Check documents (10 pts)
  const { count: docCount } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('home_id', homeId);
  if (docCount && docCount >= 3) score += 10;
  else if (docCount && docCount >= 1) score += 5;

  // Agent attestation bonus (10 pts)
  if (home?.agent_attested_at) score += 10;

  // 2026-04-29: Certified inspection within the last 12 months (10 pts)
  // Rewards homes that have an HMAC-signed inspection record from a Canopy
  // certified inspector — surfaces directly on the buyer-facing Home Token.
  if (home?.last_certified_inspection_at) {
    const inspectedAt = new Date(home.last_certified_inspection_at);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (inspectedAt > oneYearAgo) score += 10;
  }

  const finalScore = Math.min(score, maxScore);

  // Store it
  await supabase.from('homes').update({ record_completeness_score: finalScore }).eq('id', homeId);

  return finalScore;
}

/** Generate Home Token share URL for QR code */
export function generateHomeTokenShareUrl(transferToken: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/home-token/share/${transferToken}`;
}

/** Look up a pending transfer by its token (for the public share view).
 *  Returns the transfer + joined home summary when the token is active, or null otherwise.
 *  Note: RLS on home_transfers must permit reading by transfer_token. */
export async function getTransferByToken(
  transferToken: string
): Promise<{ transfer: HomeTransfer; home: any } | null> {
  const { data: transfer, error: tErr } = await supabase
    .from('home_transfers')
    .select('*')
    .eq('transfer_token', transferToken)
    .maybeSingle();
  if (tErr) { logger.warn('Failed to resolve transfer token:', tErr); return null; }
  if (!transfer) return null;
  const { data: home, error: hErr } = await supabase
    .from('homes')
    .select('id,address,city,state,zip_code,photo_url,year_built,square_footage,record_completeness_score,agent_attested_at,ownership_verified,last_certified_inspection_at,last_certified_inspection_id,certified_inspection_count,user_id')
    .eq('id', transfer.home_id)
    .maybeSingle();
  if (hErr) { logger.warn('Failed to load home for transfer:', hErr); return null; }
  return { transfer, home };
}

/** Interface for home token attestations */
export interface HomeTokenAttestation {
  id: string;
  home_id: string;
  attestor_user_id: string;
  attestor_name: string;
  attestor_role: 'agent' | 'inspector' | 'contractor' | 'pro';
  statement: string;
  signed_at: string;
  created_at: string;
  updated_at: string;
}

/** Get all attestations for a home */
export async function getHomeTokenAttestations(homeId: string): Promise<HomeTokenAttestation[]> {
  const { data, error } = await supabase
    .from('home_token_attestations')
    .select('*')
    .eq('home_id', homeId)
    .order('signed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Add agent/pro attestation to a home token */
export async function addHomeTokenAttestation(
  homeId: string,
  statement: string,
  role: 'agent' | 'inspector' | 'contractor' | 'pro' = 'agent'
): Promise<HomeTokenAttestation> {
  const { data, error } = await supabase.rpc('add_home_token_attestation', {
    p_home_id: homeId,
    p_statement: statement,
    p_attestor_role: role,
  });
  if (error) throw error;
  return data;
}
