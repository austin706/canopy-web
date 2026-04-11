// ===============================================================
// Calendar Domain (iCal subscription)
// ===============================================================
import { supabase, SUPABASE_URL } from './supabaseClient';

/**
 * Fetch the user's current calendar subscription token. Returns null if
 * none has been issued yet. The token is the sole credential for the
 * public `ical-feed` edge function, so treat it like a password.
 */
export const getCalendarToken = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('calendar_token')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return (data as { calendar_token: string | null } | null)?.calendar_token ?? null;
};

/**
 * Generate a new calendar token and persist it to the user's profile.
 * Rotating the token invalidates any previously subscribed calendar URLs.
 * Uses the `generate_calendar_token` Postgres RPC defined in migration 042.
 */
export const rotateCalendarToken = async (userId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('generate_calendar_token');
  if (error) throw error;
  const token = data as string;
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ calendar_token: token })
    .eq('id', userId);
  if (updateErr) throw updateErr;
  return token;
};

/**
 * Build the public webcal/https subscription URL for the ical-feed edge
 * function. Calendar apps (Apple Calendar, Google Calendar, Outlook)
 * accept https:// for one-time import or webcal:// for live subscription.
 */
export const buildICalSubscribeUrl = (token: string): string => {
  return `${SUPABASE_URL}/functions/v1/ical-feed?token=${encodeURIComponent(token)}`;
};
