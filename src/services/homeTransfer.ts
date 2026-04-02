import { supabase, sendNotification } from '@/services/supabase';

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
  // 1. Get the transfer record
  const { data: transfer, error: fetchErr } = await supabase
    .from('home_transfers')
    .select('*')
    .eq('id', transferId)
    .single();
  if (fetchErr || !transfer) throw fetchErr || new Error('Transfer not found');

  if (transfer.status !== 'pending') {
    throw new Error('This transfer is no longer active');
  }

  const homeId = transfer.home_id;

  // 2. Re-parent the home record
  const { error: homeErr } = await supabase
    .from('homes')
    .update({
      user_id: newOwnerId,
      agent_attested_at: null,       // Clear seller's agent attestation
      agent_attestation_note: null,
    })
    .eq('id', homeId);
  if (homeErr) throw homeErr;

  // 3. Clear secure notes (alarm codes, wifi passwords) — don't transfer these
  // This is a privacy-critical operation: failing to delete means the new owner
  // could see the previous owner's alarm codes, wifi passwords, etc.
  const { error: notesErr } = await supabase
    .from('secure_notes')
    .delete()
    .eq('home_id', homeId);
  if (notesErr) {
    console.error('CRITICAL: Failed to clear secure notes during home transfer:', notesErr);
    throw new Error('Home transfer blocked: could not clear previous owner\'s secure notes. Please try again or contact support.');
  }

  // 4. Update the profile — remove agent linkage for new owner's home
  // (The new owner keeps their own agent if any — we don't touch profiles)

  // 5. Mark the transfer as accepted
  const { error: updateErr } = await supabase
    .from('home_transfers')
    .update({
      status: 'accepted',
      to_user_id: newOwnerId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId);
  if (updateErr) throw updateErr;

  // 6. Notify the seller that the transfer was accepted
  try {
    const fromUserId = transfer.from_user_id;
    if (fromUserId) {
      const { data: buyer } = await supabase.from('profiles').select('full_name, email').eq('id', newOwnerId).single();
      const { data: home } = await supabase.from('homes').select('address, city').eq('id', homeId).single();
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
  } catch (e) { console.warn('Failed to send transfer accepted notification:', e); }
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
    } catch (e) { console.warn('Failed to send transfer declined notification:', e); }
  }
}

/** Cancel a pending transfer (by the seller) */
export async function cancelTransfer(transferId: string): Promise<void> {
  const { error } = await supabase
    .from('home_transfers')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', transferId);
  if (error) throw error;
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
    // Buyer doesn't have a Canopy account — send a direct email via the edge function
    // using the send-direct-email mode so they still get notified
    const acceptUrl = `https://canopyhome.app/transfer/accept?token=${transferToken}&email=${encodeURIComponent(toEmail.toLowerCase())}`;
    try {
      await supabase.functions.invoke('send-notifications', {
        body: {
          direct_email: true,
          recipient_email: toEmail.toLowerCase(),
          subject: `${fromUserName} wants to transfer a home record to you`,
          title: 'Home Record Transfer',
          body: `${fromUserName} wants to transfer their home record at ${homeAddress} to you on Canopy Home. This includes the full maintenance history, equipment inventory, and inspection reports.\n\nCanopy is a free home management app that helps you track maintenance, equipment, and more. Create your free account to accept this transfer.`,
          action_url: acceptUrl,
          action_label: 'Accept Transfer',
        },
      });
    } catch (e) {
      console.warn('Failed to send transfer email to non-Canopy buyer:', e);
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
  if (error) console.warn('Failed to track edit:', error);
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

  const finalScore = Math.min(score, maxScore);

  // Store it
  await supabase.from('homes').update({ record_completeness_score: finalScore }).eq('id', homeId);

  return finalScore;
}
