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

// --- Web Push Subscription ---

/**
 * Register for browser-based Web Push notifications.
 *
 * 1. Checks browser support (Service Workers, PushManager)
 * 2. Requests notification permission from user
 * 3. Subscribes to push notifications with VAPID public key
 * 4. Stores the subscription (endpoint + keys) in profiles.web_push_subscription
 *
 * @returns Promise<{ subscribed: boolean; message: string }>
 */
export const registerForWebPush = async (
  userId: string,
): Promise<{ subscribed: boolean; message: string }> => {
  try {
    // Check browser support
    if (!('serviceWorker' in navigator)) {
      logger.warn('[Web Push] Service Workers not supported');
      return { subscribed: false, message: 'Service Workers not supported in this browser' };
    }

    if (!('PushManager' in window)) {
      logger.warn('[Web Push] PushManager not supported');
      return { subscribed: false, message: 'Web Push not supported in this browser' };
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      logger.info('[Web Push] Notification permission denied by user');
      return { subscribed: false, message: 'Notification permission denied' };
    }

    // Get Service Worker registration
    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key from environment
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      logger.error('[Web Push] VITE_VAPID_PUBLIC_KEY not configured');
      return { subscribed: false, message: 'Web Push not configured on server' };
    }

    // Convert base64 VAPID key to Uint8Array
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as BufferSource,
    });

    // Store subscription in database
    const subscriptionJson = subscription.toJSON();
    const { error } = await supabase
      .from('profiles')
      .update({ web_push_subscription: subscriptionJson })
      .eq('id', userId);

    if (error) {
      logger.error('[Web Push] Failed to save subscription:', error);
      return { subscribed: false, message: 'Failed to save subscription' };
    }

    logger.info('[Web Push] Successfully subscribed to push notifications');
    return { subscribed: true, message: 'Browser notifications enabled' };
  } catch (error) {
    logger.error('[Web Push] Registration failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { subscribed: false, message };
  }
};

/**
 * Unregister from Web Push notifications.
 *
 * 1. Gets current subscription
 * 2. Unsubscribes from push
 * 3. Clears stored subscription from database
 *
 * @returns Promise<{ unsubscribed: boolean; message: string }>
 */
export const unregisterWebPush = async (
  userId: string,
): Promise<{ unsubscribed: boolean; message: string }> => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { unsubscribed: true, message: 'Web Push not supported' };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      logger.info('[Web Push] Unsubscribed from push notifications');
    }

    // Clear subscription from database
    const { error } = await supabase
      .from('profiles')
      .update({ web_push_subscription: null })
      .eq('id', userId);

    if (error) {
      logger.error('[Web Push] Failed to clear subscription:', error);
      return { unsubscribed: false, message: 'Failed to clear subscription' };
    }

    logger.info('[Web Push] Successfully unsubscribed');
    return { unsubscribed: true, message: 'Browser notifications disabled' };
  } catch (error) {
    logger.error('[Web Push] Unregistration failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { unsubscribed: false, message };
  }
};

/**
 * Check if user is currently subscribed to Web Push.
 *
 * @returns Promise<boolean> true if subscribed, false otherwise
 */
export const isWebPushSubscribed = async (): Promise<boolean> => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    logger.error('[Web Push] Failed to check subscription status:', error);
    return false;
  }
};

/**
 * Convert base64-encoded VAPID public key to Uint8Array.
 * Web Push API requires the key in Uint8Array format.
 *
 * @param base64String - Base64-encoded public key
 * @returns Uint8Array representation of the key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
