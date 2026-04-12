// ===============================================================
// Tasks Domain
// ===============================================================
import { supabase } from './supabaseClient';
import { sendNotification } from './notifications';
import type { MaintenanceTask } from '@/types';

/** Notify all other members of a home about an event (excludes the actor) */
async function notifyHomeMembers(homeId: string, excludeUserId: string, title: string, body: string, category: string, actionUrl: string) {
  try {
    // Get the home owner
    const { data: home } = await supabase.from('homes').select('user_id').eq('id', homeId).single();
    // Get all home_members
    const { data: members } = await supabase
      .from('home_members')
      .select('user_id')
      .eq('home_id', homeId)
      .eq('invite_status', 'accepted')
      .not('user_id', 'is', null);

    const userIds = new Set<string>();
    if (home?.user_id && home.user_id !== excludeUserId) userIds.add(home.user_id);
    for (const m of members || []) {
      if (m.user_id && m.user_id !== excludeUserId) userIds.add(m.user_id);
    }

    for (const uid of userIds) {
      sendNotification({ user_id: uid, title, body, category, action_url: actionUrl }).catch(() => {});
    }
  } catch {}
}

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

  // Notify other home members
  if (data?.home_id && data?.user_id) {
    notifyHomeMembers(data.home_id, data.user_id,
      'Task Completed',
      `"${data.title || 'A maintenance task'}" has been marked as complete.`,
      'task', '/dashboard');
  }

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

  // Notify other home members
  if (data?.home_id && data?.user_id) {
    notifyHomeMembers(data.home_id, data.user_id,
      'Task Reopened',
      `"${data.title || 'A maintenance task'}" has been reopened and needs attention.`,
      'task', '/dashboard');
  }

  return data;
};

export const createTask = async (task: Partial<MaintenanceTask>) => {
  const { data, error } = await supabase.from('maintenance_tasks').insert(task).select().single();
  if (error) throw error;

  // Notify other home members about the new task (skip bulk creates via createTasks)
  if (data?.home_id) {
    const actorId = (task as Record<string, unknown>).user_id as string || '';
    notifyHomeMembers(data.home_id, actorId,
      'New Task Added',
      `"${data.title || 'A new task'}" has been added to your home maintenance list.`,
      'task', '/dashboard');
  }

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
