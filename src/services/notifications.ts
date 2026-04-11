// ===============================================================
// Notifications Domain
// ===============================================================
import { supabase } from './supabaseClient';
import logger from '@/utils/logger';

// --- Notifications Feed ---

export const getNotifications = async (userId: string, limit = 50) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

// getUnreadNotificationCount is unused — notification badge uses getNotifications().filter(n => !n.read)
// export const getUnreadNotificationCount = async (userId: string) => { ... };

export const markNotificationRead = async (id: string) => {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
};

export const markAllNotificationsRead = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
};

/**
 * Save a notification to the database.
 *
 * Email and push delivery are handled server-side by a pg_cron job that calls
 * send-notifications?mode=process-queue every 2 minutes. This decouples the
 * fast in-app save (done here) from the slower email/push delivery, which
 * must happen server-to-server (the browser→edge function POST path is broken
 * by a CORS issue where the POST never reaches the function after preflight).
 *
 * The process-queue picks up rows with pushed=false OR emailed=false, sends
 * the email/push, and marks them delivered.
 */
export const sendNotification = async (params: {
  user_id: string;
  title: string;
  body: string;
  category?: string;
  action_url?: string;
  data?: Record<string, unknown>;
}): Promise<{ saved: boolean }> => {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.user_id,
    title: params.title,
    body: params.body,
    category: params.category || 'general',
    action_url: params.action_url || null,
    data: params.data || null,
    read: false,
    pushed: false,
    emailed: false,
  });
  if (error) {
    logger.error('sendNotification insert failed:', error);
    return { saved: false };
  }
  return { saved: true };
};

/**
 * Queue an email-only notification for a recipient who may not have a Canopy account.
 * Used for agents without accounts, external parties, etc.
 * The process-queue cron will pick this up and send via Resend.
 * If the recipient also has a Canopy account, pass their user_id to also create an in-app notification.
 */
export const sendDirectEmailNotification = async (params: {
  recipient_email: string;
  title: string;
  body: string;
  subject?: string;
  category?: string;
  action_url?: string;
  action_label?: string;
  user_id?: string; // optional: also saves in-app notification if they have an account
}): Promise<{ saved: boolean }> => {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.user_id || null,
    recipient_email: params.recipient_email,
    title: params.title,
    body: params.body,
    category: params.category || 'general',
    action_url: params.action_url || null,
    data: params.action_label ? { action_label: params.action_label, subject: params.subject } : null,
    read: false,
    pushed: false,
    emailed: false,
    // Mark this row as ready for the retry worker to pick up on its next
    // tick. If the inline sender succeeds first and flips `emailed=true`,
    // the worker's partial index will drop the row from consideration.
    email_next_retry_at: new Date().toISOString(),
  });
  if (error) {
    logger.error('sendDirectEmailNotification insert failed:', error);
    return { saved: false };
  }
  return { saved: true };
};

// --- Notification Preferences ---

export const getNotificationPreferences = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.notification_preferences || null;
};

export const updateNotificationPreferences = async (userId: string, preferences: Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ notification_preferences: preferences })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
