// ===============================================================
// Tasks Domain
// ===============================================================
import { supabase } from './supabaseClient';
import type { MaintenanceTask } from '@/types';

export const getTasks = async (homeId: string) => {
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .select('*')
    .eq('home_id', homeId)
    .is('deleted_at', null)
    .order('due_date');
  if (error) throw error;
  return data || [];
};

export const completeTask = async (taskId: string, notes?: string, photoUrl?: string) => {
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .update({
      status: 'completed',
      completed_date: new Date().toISOString(),
      completion_notes: notes,
      completion_photo_url: photoUrl,
    })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const reopenTask = async (taskId: string) => {
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .update({
      status: 'upcoming',
      completed_date: null,
      completion_notes: null,
      completion_photo_url: null,
    })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const createTask = async (task: Partial<MaintenanceTask>) => {
  const { data, error } = await supabase.from('maintenance_tasks').insert(task).select().single();
  if (error) throw error;
  return data;
};

export const createTasks = async (tasks: Partial<MaintenanceTask>[]) => {
  const { data, error } = await supabase.from('maintenance_tasks').insert(tasks).select();
  if (error) throw error;
  return data || [];
};

export const deleteTask = async (taskId: string) => {
  const { error } = await supabase
    .from('maintenance_tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
};
