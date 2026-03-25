// ===============================================================
// Canopy Web — Shared Utilities
// ===============================================================
import type { MaintenanceTask, MaintenanceLog } from '@/types';
import { completeTask, addMaintenanceLog, createTask, supabase } from '@/services/supabase';
import { createNextDynamicTask } from '@/services/taskEngine';
import { useStore } from '@/store/useStore';

/** Generate a UUID v4 */
export const generateUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * Full task-completion flow:
 *  1. Update local store (immediate UI feedback)
 *  2. Create a maintenance log entry (local + Supabase)
 *  3. Persist status change to Supabase
 */
export const quickCompleteTask = async (task: MaintenanceTask): Promise<void> => {
  const store = useStore.getState();
  const homeId = task.home_id || store.home?.id || '';

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
  store.addMaintenanceLog(logEntry);

  // 3. Persist to Supabase (non-blocking — UI already updated)
  try { await completeTask(task.id); } catch (err) { console.warn('Task complete API call failed:', err); }
  try { await addMaintenanceLog(logEntry); } catch (err) { console.warn('Maintenance log save failed:', err); }

  // 4. If this is a dynamic task, schedule the next occurrence
  const nextTask = createNextDynamicTask(task, new Date().toISOString());
  if (nextTask) {
    // Add to local store immediately
    useStore.getState().addTask(nextTask);
    // Persist to Supabase
    try { await createTask(nextTask); } catch (err) { console.warn('Next dynamic task creation failed:', err); }
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
