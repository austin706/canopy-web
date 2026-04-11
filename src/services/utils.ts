// ===============================================================
// Canopy Web — Shared Utilities
// ===============================================================
import type { MaintenanceTask, MaintenanceLog } from '@/types';
import { completeTask, addMaintenanceLog, createTask, supabase } from '@/services/supabase';
import { createNextDynamicTask } from '@/services/taskEngine';
import { useStore } from '@/store/useStore';
import { showToast } from '@/components/Toast';

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
  let logEntryId: string;

  // 1. Optimistic local update
  store.completeTask(task.id);

  // 2. Build & persist maintenance log
  const logEntry: MaintenanceLog = {
    id: generateUUID(),
    home_id: homeId,
    task_id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    completed_date: new Date().toISOString(),
    completed_by: 'homeowner',
    photos: [],
    created_at: new Date().toISOString(),
  };
  logEntryId = logEntry.id;
  store.addMaintenanceLog(logEntry);

  // 3. Persist to Supabase (non-blocking — UI already updated)
  try { await completeTask(task.id); } catch (err) { console.warn('Task complete API call failed:', err); }
  try { await addMaintenanceLog(logEntry); } catch (err) { console.warn('Maintenance log save failed:', err); }

  // 4. If this is a dynamic task, schedule the next occurrence
  let nextTask: MaintenanceTask | null = null;
  const nextDynamicTask = createNextDynamicTask(task, new Date().toISOString());
  if (nextDynamicTask) {
    nextTask = nextDynamicTask;
    // Add to local store immediately
    useStore.getState().addTask(nextTask);
    // Persist to Supabase
    try { await createTask(nextTask); } catch (err) { console.warn('Next dynamic task creation failed:', err); }
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
    console.warn('Failed to revert task status:', err);
  }

  try {
    // Delete the maintenance log
    await supabase.from('maintenance_logs')
      .delete()
      .eq('id', logEntryId);
  } catch (err) {
    console.warn('Failed to delete maintenance log:', err);
  }

  if (nextDynamicTask) {
    try {
      // Delete the next dynamic task
      await supabase.from('maintenance_tasks')
        .delete()
        .eq('id', nextDynamicTask.id);
    } catch (err) {
      console.warn('Failed to delete next dynamic task:', err);
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
  } catch (err) { console.warn('Skip task API call failed:', err); }
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
  } catch (err) { console.warn('Snooze task API call failed:', err); }
};
