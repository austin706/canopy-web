// Google Places autocomplete — proxied through Supabase edge function
// so the API key stays server-side.

import { supabase } from '@/services/supabase';
import logger from '@/utils/logger';

export interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export interface PlaceDetails {
  /** Canonical Google Places ID — stored as homes.google_place_id for dedup. */
  placeId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  formatted: string;
}

/**
 * Fetch autocomplete predictions for a partial address input.
 * Returns an empty array if input is <3 chars or API is unavailable.
 */
export async function fetchPlacePredictions(
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  if (!input || input.trim().length < 3) return [];

  try {
    const { data, error } = await supabase.functions.invoke('places-autocomplete', {
      body: { mode: 'autocomplete', input, sessionToken },
    });
    if (error) {
      logger.warn('[placesAutocomplete] fetch failed:', error);
      return [];
    }
    return (data?.predictions ?? []) as PlacePrediction[];
  } catch (err) {
    logger.warn('[placesAutocomplete] exception:', err);
    return [];
  }
}

/**
 * Fetch the full place details for a selected prediction.
 * Returns null if the lookup fails.
 */
export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails | null> {
  try {
    const { data, error } = await supabase.functions.invoke('places-autocomplete', {
      body: { mode: 'details', placeId, sessionToken },
    });
    if (error || !data || data.error) {
      logger.warn('[placeDetails] fetch failed:', error || data?.error);
      return null;
    }
    return data as PlaceDetails;
  } catch (err) {
    logger.warn('[placeDetails] exception:', err);
    return null;
  }
}

/** Generate a fresh session token (billing consolidation per Places API docs). */
export function newPlacesSessionToken(): string {
  return crypto.randomUUID();
}
