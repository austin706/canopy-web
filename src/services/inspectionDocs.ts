import { supabase } from '@/services/supabase';

export interface InspectionDocument {
  id: string;
  visit_id: string;
  inspection_id?: string;
  file_name: string;
  file_url: string;
  file_type: string; // 'pdf' | 'image' | 'other'
  file_size_bytes: number;
  uploaded_by: string; // user_id
  notes?: string;
  created_at: string;
}

// Upload an inspection document (PDF or image) to Supabase storage and create record
export async function uploadInspectionDoc(
  visitId: string,
  file: File,
  uploadedBy: string,
  inspectionId?: string,
  notes?: string
): Promise<InspectionDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const fileType = ext === 'pdf' ? 'pdf' : ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? 'image' : 'other';
  const storagePath = `inspection-docs/${visitId}/${crypto.randomUUID()}.${ext}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);

  // Create record in visit_documents table
  const { data, error } = await supabase
    .from('visit_documents')
    .insert({
      visit_id: visitId,
      inspection_id: inspectionId || null,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_type: fileType,
      file_size_bytes: file.size,
      uploaded_by: uploadedBy,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Get all documents for a visit
export async function getVisitDocuments(visitId: string): Promise<InspectionDocument[]> {
  const { data, error } = await supabase
    .from('visit_documents')
    .select('*')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Delete an inspection document
export async function deleteInspectionDoc(docId: string): Promise<void> {
  const { error } = await supabase
    .from('visit_documents')
    .delete()
    .eq('id', docId);
  if (error) throw error;
}
