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

/**
 * Atomic RPC: update task + insert log + spawn next dynamic task.
 * Called by quickCompleteTask for the normal completion path. Returns
 * the server-side rows so the client can reconcile its optimistic ids.
 */
export interface CompleteTaskRpcResult {
  completed_task: MaintenanceTask;
  log: { id: string; [k: string]: unknown };
  next_task: MaintenanceTask | null;
  already_completed: boolean;
}

export const completeTaskWithRecurrence = async (args: {
  taskId: string;
  notes?: string;
  photoUrl?: string;
  completedBy?: 'homeowner' | 'pro' | 'contractor';
  cost?: number | null;
  completedByProId?: string | null;
  nextTask?: MaintenanceTask | null;
}): Promise<CompleteTaskRpcResult> => {
  const { data, error } = await supabase.rpc('complete_task_with_recurrence', {
    p_task_id: args.taskId,
    p_notes: args.notes ?? null,
    p_photo_url: args.photoUrl ?? null,
    p_completed_by: args.completedBy ?? 'homeowner',
    p_cost: args.cost ?? null,
    p_completed_by_pro_id: args.completedByProId ?? null,
    p_next_task: args.nextTask ? (args.nextTask as unknown as Record<string, unknown>) : null,
  });
  if (error) throw error;
  const result = data as CompleteTaskRpcResult;

  // Fan out notifications (homeowner/members) only on first completion.
  const completed = result?.completed_task;
  if (completed?.home_id && !result?.already_completed) {
    const actorId = (completed as unknown as { user_id?: string }).user_id || '';
    notifyHomeMembers(completed.home_id, actorId,
      'Task Completed',
      `"${completed.title || 'A maintenance task'}" has been marked as complete.`,
      'task', '/dashboard');
  }
  return result;
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

/**
 * Bulk-insert generated tasks. Uses upsert with `ignoreDuplicates: true`
 * so concurrent generator passes (e.g. web tab + mobile app) can't
 * produce duplicate rows for the same (home, template, equipment,
 * due_date) tuple — the partial UNIQUE INDEX defined in migration 060
 * silently drops conflicts.
 */
export const createTasks = async (tasks: Partial<MaintenanceTask>[]) => {
  if (!tasks.length) return [];
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .upsert(tasks, {
      onConflict: 'home_id,template_id,equipment_id,due_date',
      ignoreDuplicates: true,
    })
    .select();
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

// ─── C-11 (migration 066): stale template tasks ───
export interface StaleTemplateTask {
  task_id: string;
  template_id: string;
  task_title: string;
  /** The template_version the template is at now (higher = admin edited it). */
  current_template_version: number;
  /** The template_version this task was generated at (lower = stale). */
  task_template_version: number | null;
}

/** Return pending/overdue tasks whose underlying template has been edited since
 *  the task was generated. Used to power the "Refresh stale tasks" affordance
 *  on the dashboard and HomeDetails. Any authenticated user can query their own
 *  homes; admins can query any home. See migration_066_template_version.sql. */
export const listStaleTemplateTasks = async (homeId: string): Promise<StaleTemplateTask[]> => {
  const { data, error } = await supabase.rpc('list_stale_template_tasks', { p_home_id: homeId });
  if (error) throw error;
  return (data ?? []) as StaleTemplateTask[];
};

/** Soft-delete the given stale tasks so the next generation pass can
 *  recreate them at the current template_version. We intentionally do not
 *  hard-delete — homeowners have history to preserve. */
export const clearStaleTemplateTasks = async (taskIds: string[]): Promise<void> => {
  if (taskIds.length === 0) return;
  const { error } = await supabase
    .from('maintenance_tasks')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', taskIds);
  if (error) throw error;
};
