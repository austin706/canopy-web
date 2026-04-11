// ===============================================================
// Photos Domain (File Upload)
// ===============================================================
import { supabase } from './supabaseClient';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (reduced from 20 MB for security)

export const uploadPhoto = async (bucket: string, path: string, file: File) => {
  // Validate file size (client-side check before upload)
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is 10MB.`);
  }

  // Validate MIME type
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`File type "${file.type}" is not allowed. Accepted: JPEG, PNG, HEIC, WebP, PDF.`);
  }

  const { data, error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
};
