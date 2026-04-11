// ===============================================================
// Documents & Secure Storage Domain
// ===============================================================
import { supabase } from './supabaseClient';

// --- Documents ---

export const getDocuments = async (homeId: string) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('home_id', homeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createDocument = async (doc: {
  home_id: string;
  user_id: string;
  title: string;
  category: string;
  file_url: string;
  thumbnail_url?: string;
}) => {
  const { data, error } = await supabase
    .from('documents')
    .insert(doc)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteDocument = async (id: string) => {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
};

// --- Secure Notes ---

export const getSecureNotes = async (homeId: string) => {
  const { data, error } = await supabase
    .from('secure_notes')
    .select('*')
    .eq('home_id', homeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createSecureNote = async (note: {
  home_id: string;
  title: string;
  content: string;
  category: string;
}) => {
  const { data, error } = await supabase
    .from('secure_notes')
    .insert(note)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteSecureNote = async (id: string) => {
  const { error } = await supabase.from('secure_notes').delete().eq('id', id);
  if (error) throw error;
};

// ─── Vault PIN (bcrypt-hashed server-side via pgcrypto RPCs) ───

/** Check whether the user has a vault PIN set (no hash exposed to client). */
export const hasVaultPin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('has_vault_pin', { p_user_id: userId });
  if (error) throw error;
  return data === true;
};

/** Set or update the vault PIN. The raw PIN is sent over HTTPS and bcrypt-hashed in Postgres. */
export const setVaultPin = async (userId: string, pin: string): Promise<void> => {
  const { error } = await supabase.rpc('set_vault_pin', { p_user_id: userId, p_pin: pin });
  if (error) throw error;
};

/** Verify a PIN attempt against the stored bcrypt hash. Returns true/false. */
export const verifyVaultPin = async (userId: string, pin: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('verify_vault_pin', { p_user_id: userId, p_pin: pin });
  if (error) throw error;
  return data === true;
};

/** Remove the vault PIN entirely. */
export const removeVaultPin = async (userId: string): Promise<void> => {
  const { error } = await supabase.rpc('remove_vault_pin', { p_user_id: userId });
  if (error) throw error;
};

// Legacy aliases for backward compatibility
export const getVaultPin = async (userId: string) => {
  const hasPinSet = await hasVaultPin(userId);
  return hasPinSet ? { pin_hash: '__bcrypt_protected__' } : null;
};

export const upsertVaultPin = async (userId: string, pin: string) => {
  await setVaultPin(userId, pin);
  return { user_id: userId, pin_hash: '__bcrypt_protected__' };
};
