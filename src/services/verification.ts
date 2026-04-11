// ===============================================================
// Ownership Verification Domain
// ===============================================================
import { supabase } from './supabaseClient';
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
  return data;
};

