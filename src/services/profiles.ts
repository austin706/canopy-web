// ===============================================================
// Profiles Domain
// ===============================================================
import { supabase } from './supabaseClient';

export const updateProfile = async (userId: string, updates: Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getProfile = async (userId: string) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
};

// --- Account Management ---

/** Delete a user account and all associated data */
export const deleteUserAccount = async (userId: string) => {
  const { error } = await supabase.rpc('delete_user_and_data', { target_user_id: userId });
  if (error) throw error;
};

/** Export all user data (GDPR/CCPA compliance) */
export const exportUserData = async (userId: string): Promise<Record<string, unknown>> => {
  const { data, error } = await supabase.rpc('export_user_data', { target_user_id: userId });
  if (error) throw error;
  return (data as Record<string, unknown>) || {};
};
