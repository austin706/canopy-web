// ===============================================================
// Technician Documents
// ===============================================================
import { supabase } from './supabaseClient';


// ─── Technician Documents ───

export type TechDocumentType =
  | 'contractor_agreement'
  | 'safety_acknowledgment'
  | 'w9'
  | 'direct_deposit'
  | 'insurance_verification'
  | 'drivers_license'
  | 'background_check_consent'
  | 'background_check_result';

export interface TechnicianDocument {
  id: string;
  provider_id: string;
  document_type: TechDocumentType;
  file_path: string | null;
  signature_data_url: string | null;
  agreement_version: string | null;
  agreement_text_hash: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_ip: string | null;
  status: 'pending' | 'signed' | 'verified' | 'expired' | 'rejected';
  notes: string | null;
  metadata: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const getTechnicianDocuments = async (providerId: string): Promise<TechnicianDocument[]> => {
  const { data, error } = await supabase
    .from('technician_documents')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const signTechnicianDocument = async (
  providerId: string,
  documentType: TechDocumentType,
  signatureDataUrl: string,
  signerName: string,
  agreementVersion?: string,
  agreementTextHash?: string,
): Promise<TechnicianDocument> => {
  const { data, error } = await supabase
    .from('technician_documents')
    .upsert({
      provider_id: providerId,
      document_type: documentType,
      signature_data_url: signatureDataUrl,
      signer_name: signerName,
      agreement_version: agreementVersion || null,
      agreement_text_hash: agreementTextHash || null,
      signed_at: new Date().toISOString(),
      status: 'signed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider_id,document_type' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const uploadTechnicianDocument = async (
  providerId: string,
  documentType: TechDocumentType,
  file: File,
): Promise<TechnicianDocument> => {
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${providerId}/${documentType}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('technician-documents')
    .upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('technician_documents')
    .upsert({
      provider_id: providerId,
      document_type: documentType,
      file_path: path,
      status: 'signed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider_id,document_type' })
    .select()
    .single();
  if (error) throw error;
  return data;
};


