// ===============================================================
// Ownership Verification Domain
// ===============================================================
import { supabase } from './supabaseClient';
import { sendNotification } from './notifications';
import type { Home } from '@/types';
import { uploadPhoto } from './photos';


// ─── Ownership Verification ─────────────────────────────────────

/** Upload a verification document (ID, utility bill, etc.) for a home */
export const uploadVerificationDocument = async (
  homeId: string,
  file: File,
): Promise<string> => {
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${homeId}/verification_${Date.now()}.${ext}`;
  const url = await uploadPhoto('photos', path, file);
  return url;
};

/** Submit ownership verification request */
export const submitOwnershipVerification = async (
  homeId: string,
  documentUrls: string[],
  method: 'document_upload' | 'title_company' | 'manual' = 'document_upload',
): Promise<Home> => {
  const { data, error } = await supabase
    .from('homes')
    .update({
      ownership_verification_status: 'pending',
      ownership_verification_method: method,
      ownership_documents_url: documentUrls.join(','),
      ownership_verification_date: new Date().toISOString(),
    })
    .eq('id', homeId)
    .select()
    .single();
  if (error) throw error;

  // Notify the homeowner their submission was received
  if (data?.user_id) {
    try {
      await sendNotification({
        user_id: data.user_id,
        title: 'Verification Submitted',
        body: 'Your ownership verification documents have been submitted and are under review. We\'ll notify you once reviewed.',
        category: 'verification',
        action_url: '/dashboard',
      });
    } catch {}
  }

  // Notify admins of new submission
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
    for (const admin of admins || []) {
      await sendNotification({
        user_id: admin.id,
        title: 'New Verification Request',
        body: `A homeowner has submitted ownership verification documents for ${data?.address || 'a property'}. Review needed.`,
        category: 'verification',
        action_url: '/admin/verification',
      });
    }
  } catch {}

  return data;
};

/** Admin: Get all homes with pending verification */
export const getPendingVerifications = async (): Promise<Home[]> => {
  const { data, error } = await supabase
    .from('homes')
    .select('*')
    .eq('ownership_verification_status', 'pending')
    .order('ownership_verification_date', { ascending: true });
  if (error) throw error;
  return (data || []) as Home[];
};

/** Admin: Get all homes with any verification status (for history) */
export const getAllVerifications = async (): Promise<Home[]> => {
  const { data, error } = await supabase
    .from('homes')
    .select('*')
    .neq('ownership_verification_status', 'none')
    .not('ownership_verification_status', 'is', null)
    .order('ownership_verification_date', { ascending: false });
  if (error) throw error;
  return (data || []) as Home[];
};

/** Admin: Approve or reject a verification */
export const reviewOwnershipVerification = async (
  homeId: string,
  decision: 'verified' | 'rejected',
  notes?: string,
): Promise<Home> => {
  const updates: Record<string, unknown> = {
    ownership_verification_status: decision,
    ownership_verified: decision === 'verified',
    ownership_verification_date: new Date().toISOString(),
  };
  if (notes) updates.ownership_verification_notes = notes;

  const { data, error } = await supabase
    .from('homes')
    .update(updates)
    .eq('id', homeId)
    .select()
    .single();
  if (error) throw error;

  // Notify the homeowner of the decision
  if (data?.user_id) {
    try {
      if (decision === 'verified') {
        await sendNotification({
          user_id: data.user_id,
          title: 'Ownership Verified',
          body: 'Your ownership verification has been approved! Your home now has a verified badge.',
          category: 'verification',
          action_url: '/dashboard',
        });
      } else {
        await sendNotification({
          user_id: data.user_id,
          title: 'Verification Update',
          body: `Your ownership verification was not approved.${notes ? ` Reason: ${notes}` : ''} You can resubmit with additional documentation.`,
          category: 'verification',
          action_url: '/dashboard',
        });
      }
    } catch {}
  }

  return data;
};

