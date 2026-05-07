// ===============================================================
// Address Property-Identity Helpers (post-USPS removal 2026-05-07)
// ===============================================================
// USPS verification was ripped out 2026-05-07: Google Places + place_id
// are sufficient canonical identity for our use case (no mail, no legal
// records, no ZIP+4 routing). USPS rejected legitimate brand-new
// construction and rural addresses behind a confusing modal for
// negative net value.
//
// What's left here: the dedup helper that walks a layered match strategy
// against the homes table when a user is creating or claiming a property.
// The local normalize helper is retained because it powers the manual-
// entry fallback (when a user types instead of picking a Google
// suggestion).
// ===============================================================

import { supabase } from '@/services/supabase';

/**
 * Check if a property already exists in the database by:
 *   0. Google Places place_id (PRIMARY canonical identity — most reliable)
 *   1. Exact normalized_address match
 *   2. Lat/lng proximity within ~30 meters (spatial fallback)
 *   3. Original ilike string match (last resort)
 * Returns the first match found.
 */
export async function findExistingProperty(
  normalizedAddress: string,
  latitude: number | undefined,
  longitude: number | undefined,
  rawAddress: string,
  rawCity: string,
  rawState: string,
  rawZip: string,
  currentUserId?: string,
  googlePlaceId?: string,
): Promise<{ found: boolean; homeId?: string; ownerId?: string; isOwnHome?: boolean }> {

  // Helper: check a query result and return a match with ownership info
  const checkResult = (data: { id: string; user_id: string }[] | null) => {
    if (data && data.length > 0) {
      const isOwnHome = !!currentUserId && data[0].user_id === currentUserId;
      return { found: true, homeId: data[0].id, ownerId: data[0].user_id, isOwnHome };
    }
    return null;
  };

  // Strategy 0: Google Places ID is the canonical property identity.
  // When present, this is deterministic — the same physical property
  // always resolves to the same place_id.
  if (googlePlaceId) {
    const { data } = await supabase
      .from('homes')
      .select('id, user_id')
      .eq('google_place_id', googlePlaceId)
      .limit(1);
    const match = checkResult(data);
    if (match) return match;
  }

  // Strategy 1: Exact match on normalized_address
  if (normalizedAddress) {
    const { data } = await supabase
      .from('homes')
      .select('id, user_id')
      .eq('normalized_address', normalizedAddress)
      .limit(1);
    const match = checkResult(data);
    if (match) return match;
  }

  // Strategy 2: Lat/lng proximity (~30 meters ≈ 0.0003 degrees)
  if (latitude && longitude) {
    const PROXIMITY_DEGREES = 0.0003; // ~30 meters
    const { data } = await supabase
      .from('homes')
      .select('id, user_id')
      .gte('latitude', latitude - PROXIMITY_DEGREES)
      .lte('latitude', latitude + PROXIMITY_DEGREES)
      .gte('longitude', longitude - PROXIMITY_DEGREES)
      .lte('longitude', longitude + PROXIMITY_DEGREES)
      .limit(1);
    const match = checkResult(data);
    if (match) return match;
  }

  // Strategy 3: Fallback ilike match on raw address (handles pre-existing homes without normalization)
  const { data } = await supabase
    .from('homes')
    .select('id, user_id')
    .ilike('address', rawAddress.trim())
    .ilike('city', rawCity.trim())
    .ilike('state', rawState.trim())
    .eq('zip_code', rawZip.trim())
    .limit(1);
  const match = checkResult(data);
  if (match) return match;

  return { found: false };
}
