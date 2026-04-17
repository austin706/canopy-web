// ===============================================================
// Canopy Web — Shared Utilities
// ===============================================================
import type { MaintenanceTask, MaintenanceLog } from '@/types';
import { completeTask, addMaintenanceLog, createTask, supabase } from '@/services/supabase';
import { completeTaskWithRecurrence } from '@/services/tasks';
import { createNextDynamicTask } from '@/services/taskEngine';
import { useStore } from '@/store/useStore';
import { showToast } from '@/components/Toast';
import logger from '@/utils/logger';

/**
 * Rolling Home Health Score — blended algorithm.
 *
 * Three weighted components:
 *   1. Rolling 90-day completion rate (50%) — your track record carries forward
 *   2. Current month momentum (30%) — actionable "what's due now" signal
 *   3. Overdue penalty (20%) — urgency signal for neglected tasks
 *
 * Behavior by action:
 *   - Complete: improves all three components
 *   - Snooze: neutral (removes overdue penalty, but doesn't count as completed)
 *   - Skip: excluded from denominator entirely (deliberate "not applicable")
 *   - Overdue: actively drags score down, worse the longer it sits
 *
 * New users (<10 tasks in 90-day history) get a starter blend of 70% assumed
 * completion so they don't start at 0.
 */
export interface HealthScoreResult {
  score: number;           // 0-100 blended score
  rolling90: number;       // 90-day completion rate (0-100)
  currentMonth: number;    // current month completion rate (0-100)
  overdueCount: number;    // number of overdue tasks right now
  completedCount: number;  // tasks completed this month
  totalCount: number;      // eligible tasks due this month (excluding skipped)
  label: string;           // human-readable label
  color: 'green' | 'yellow' | 'red';
}

export const calculateHealthScore = (tasks: MaintenanceTask[]): HealthScoreResult => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // ─── Exclude non-scoreable tasks ───
  // Trash/recycling/yard-waste pickups are informational reminders, not maintenance.
  // Cleaning tasks hidden by the user toggle should also be excluded.
  const PICKUP_TITLES = ['Take Out Trash', 'Put Out Recycling', 'Yard Waste Pickup'];
  const scoreableTasks = tasks.filter(t => {
    // Exclude weekly/biweekly pickup reminders
    if (PICKUP_TITLES.includes(t.title)) return false;
    if (t.frequency === 'weekly' || t.frequency === 'biweekly') return false;
    return true;
  });

  // ─── Time boundaries ───
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // ─── Component 1: Rolling 90-day completion rate (50% weight) ───
  const rolling90Tasks = scoreableTasks.filter(t => {
    if (t.status === 'skipped') return false;
    const d = new Date(t.due_date);
    return d >= ninetyDaysAgo && d <= now;
  });
  const rolling90Completed = rolling90Tasks.filter(t => t.status === 'completed').length;
  const rolling90Eligible = rolling90Tasks.length;

  let rolling90Rate: number;
  if (rolling90Eligible === 0) {
    rolling90Rate = 70; // brand-new user
  } else if (rolling90Eligible < 10) {
    const realRate = (rolling90Completed / rolling90Eligible) * 100;
    const starterWeight = (10 - rolling90Eligible) / 10;
    rolling90Rate = Math.round(realRate * (1 - starterWeight) + 70 * starterWeight);
  } else {
    rolling90Rate = Math.round((rolling90Completed / rolling90Eligible) * 100);
  }

  // ─── Component 2: Current month momentum (30% weight) ───
  const monthTasks = scoreableTasks.filter(t => {
    if (t.status === 'skipped') return false;
    const d = new Date(t.due_date);
    return d >= thisMonthStart && d <= thisMonthEnd;
  });
  const monthCompleted = monthTasks.filter(t => t.status === 'completed').length;
  const monthEligible = monthTasks.length;
  const currentMonthRate = monthEligible > 0
    ? Math.round((monthCompleted / monthEligible) * 100)
    : rolling90Rate;

  // ─── Component 3: Overdue penalty (20% weight) ───
  const overdueTasks = scoreableTasks.filter(t => {
    if (t.status === 'completed' || t.status === 'skipped') return false;
    const d = new Date(t.due_date);
    d.setHours(0, 0, 0, 0);
    return d < now;
  });

  let overdueDeduction = 0;
  for (const t of overdueTasks) {
    const d = new Date(t.due_date);
    d.setHours(0, 0, 0, 0);
    const daysOverdue = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue > 30) overdueDeduction += 15;
    else if (daysOverdue > 7) overdueDeduction += 10;
    else overdueDeduction += 5;
  }
  const overdueScore = Math.max(0, 100 - overdueDeduction);

  // ─── Blend ───
  const blended = Math.round(
    rolling90Rate * 0.50 +
    currentMonthRate * 0.30 +
    overdueScore * 0.20
  );
  const score = Math.max(0, Math.min(100, blended));

  let label: string;
  let color: 'green' | 'yellow' | 'red';
  if (score >= 85) { label = 'Great shape'; color = 'green'; }
  else if (score >= 60) { label = 'Needs attention'; color = 'yellow'; }
  else { label = 'Action required'; color = 'red'; }

  return {
    score,
    rolling90: rolling90Rate,
    currentMonth: currentMonthRate,
    overdueCount: overdueTasks.length,
    completedCount: monthCompleted,
    totalCount: monthEligible,
    label,
    color,
  };
};

/** Generate a UUID v4 */
export const generateUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * Full task-completion flow with undo support:
 *  1. Update local store (immediate UI feedback)
 *  2. Create a maintenance log entry (local + Supabase)
 *  3. Persist status change to Supabase
 *  4. Show toast with undo action (5 second window)
 */
export const quickCompleteTask = async (task: MaintenanceTask): Promise<void> => {
  const store = useStore.getState();
  const homeId = task.home_id || store.home?.id || '';

  // Store previous state for undo
  const previousTask = { ...task };
  const completedAt = new Date().toISOString();

  // 1. Optimistic local update
  store.completeTask(task.id);

  // 2. Build optimistic maintenance log for local store.
  //    The RPC owns the authoritative row; we'll reconcile the id once it returns.
  const optimisticLog: MaintenanceLog = {
    id: generateUUID(),
    home_id: homeId,
    task_id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    completed_date: completedAt,
    completed_by: 'homeowner',
    photos: [],
    created_at: completedAt,
  };
  let logEntryId: string = optimisticLog.id;
  store.addMaintenanceLog(optimisticLog);

  // 3. Build the optional next-dynamic-task client-side (TASK_TEMPLATES
  //    lives in app code so we can't do this in PL/pgSQL yet). The RPC
  //    inserts it atomically with the completion + log row.
  let nextTask: MaintenanceTask | null = null;
  const nextDynamicTask = createNextDynamicTask(task, completedAt);
  if (nextDynamicTask) {
    nextTask = nextDynamicTask;
    useStore.getState().addTask(nextTask);
  }

  // 4. Call the RPC. If it's unavailable (old database), fall back to
  //    the legacy multi-step flow so clients don't break mid-rollout.
  let rpcOk = false;
  try {
    const result = await completeTaskWithRecurrence({
      taskId: task.id,
      notes: undefined,
      photoUrl: undefined,
      completedBy: 'homeowner',
      nextTask,
    });
    rpcOk = true;

    // Reconcile log id so Undo deletes the right row.
    if (result?.log?.id) {
      const storeNow = useStore.getState();
      const logs = storeNow.maintenanceLogs || [];
      storeNow.setMaintenanceLogs(
        logs.map((l) => (l.id === optimisticLog.id ? { ...l, id: result.log.id } : l))
      );
      logEntryId = result.log.id;
    }
    // If the server skipped the next task (conflict), drop it from the store.
    if (nextTask && !result?.next_task) {
      useStore.getState().removeTask(nextTask.id);
      nextTask = null;
    } else if (nextTask && result?.next_task?.id && result.next_task.id !== nextTask.id) {
      // Server used its own id; reconcile.
      const storeNow = useStore.getState();
      storeNow.removeTask(nextTask.id);
      nextTask = { ...nextTask, id: result.next_task.id };
      storeNow.addTask(nextTask);
    }
  } catch (err) {
    logger.warn('complete_task_with_recurrence RPC failed, falling back:', err);
  }

  if (!rpcOk) {
    // Legacy fallback: update + log + next-task as three separate calls.
    try { await completeTask(task.id); } catch (e) { logger.warn('Task complete API call failed:', e); }
    try { await addMaintenanceLog(optimisticLog); } catch (e) { logger.warn('Maintenance log save failed:', e); }
    if (nextTask) {
      try { await createTask(nextTask); } catch (e) { logger.warn('Next dynamic task creation failed:', e); }
    }
  }

  // 4b. If this is an as_needed task, prompt user to schedule next occurrence
  if (task.frequency === 'as_needed' && !nextDynamicTask) {
    useStore.getState().setPendingReschedule(task);
  }

  // 5. Show undo toast
  showToast({
    message: 'Task completed',
    action: {
      label: 'Undo',
      onClick: () => undoTaskCompletion(previousTask, logEntryId, nextTask),
    },
    timeout: 5000,
  });
};

/**
 * Undo a task completion by reverting status back to incomplete.
 * Removes the maintenance log and any dynamically created next task.
 */
export const undoTaskCompletion = async (
  originalTask: MaintenanceTask,
  logEntryId: string,
  nextDynamicTask: MaintenanceTask | null
): Promise<void> => {
  const store = useStore.getState();

  // 1. Revert task status in local store
  store.setTask({
    ...originalTask,
    status: 'upcoming', // Reset to upcoming status
    completed_date: undefined,
    completed_by: undefined,
  });

  // 2. Remove the maintenance log from local store
  const logs = store.maintenanceLogs || [];
  store.setMaintenanceLogs(logs.filter(log => log.id !== logEntryId));

  // 3. Remove the next dynamic task if one was created
  if (nextDynamicTask) {
    store.removeTask(nextDynamicTask.id);
  }

  // 4. Persist changes to Supabase (non-blocking)
  try {
    // Revert task status
    await supabase.from('maintenance_tasks')
      .update({ status: 'upcoming', completed_date: null, completed_by: null })
      .eq('id', originalTask.id);
  } catch (err) {
    logger.warn('Failed to revert task status:', err);
  }

  try {
    // Delete the maintenance log
    await supabase.from('maintenance_logs')
      .delete()
      .eq('id', logEntryId);
  } catch (err) {
    logger.warn('Failed to delete maintenance log:', err);
  }

  if (nextDynamicTask) {
    try {
      // Delete the next dynamic task
      await supabase.from('maintenance_tasks')
        .delete()
        .eq('id', nextDynamicTask.id);
    } catch (err) {
      logger.warn('Failed to delete next dynamic task:', err);
    }
  }
};

/**
 * Skip a task with Supabase persistence.
 */
export const quickSkipTask = async (task: MaintenanceTask): Promise<void> => {
  const store = useStore.getState();
  store.skipTask(task.id);
  try {
    await supabase.from('maintenance_tasks')
      .update({ status: 'skipped' })
      .eq('id', task.id);
  } catch (err) { logger.warn('Skip task API call failed:', err); }
};

/**
 * Snooze a task by N days with Supabase persistence.
 */
export const quickSnoozeTask = async (task: MaintenanceTask, days: number): Promise<void> => {
  const store = useStore.getState();
  store.snoozeTask(task.id, days);
  const newDate = new Date(task.due_date);
  newDate.setDate(newDate.getDate() + days);
  try {
    await supabase.from('maintenance_tasks')
      .update({ due_date: newDate.toISOString() })
      .eq('id', task.id);
  } catch (err) { logger.warn('Snooze task API call failed:', err); }
};
