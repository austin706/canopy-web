// ===============================================================
// Maintenance Logs Domain
// ===============================================================
import { supabase } from './supabaseClient';
import type { MaintenanceLog } from '@/types';

export const getMaintenanceLogs = async (homeId: string) => {
  const { data, error } = await supabase
    .from('maintenance_logs')
    .select('*')
    .eq('home_id', homeId)
    .order('completed_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const addMaintenanceLog = async (log: Partial<MaintenanceLog>) => {
  const { data, error } = await supabase.from('maintenance_logs').insert(log).select().single();
  if (error) throw error;
  return data;
};

export const updateMaintenanceLog = async (logId: string, updates: Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('maintenance_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
