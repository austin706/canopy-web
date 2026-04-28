// ===============================================================
// Address Verification — USPS Standardization + Lat/Lng Proximity
// ===============================================================
// Two-layer property identity:
//   1. USPS Address Standardization API → canonical address string
//   2. Lat/lng proximity via existing geocoding → spatial fallback
// ===============================================================

import { supabase } from '@/services/supabase';
import { geocodeAddress } from '@/services/geocoding';

export interface VerifiedAddress {
  /** USPS-standardized address line (e.g. "123 N MAIN ST APT 1") */
  normalizedAddress: string;
  /** USPS-standardized city */
  city: string;
  /** USPS 2-letter state abbreviation */
  state: string;
  /** USPS ZIP+4 (e.g. "74103-1234") or 5-digit ZIP */
  zipCode: string;
  /** Geocoded latitude */
  latitude?: number;
  /** Geocoded longitude */
  longitude?: number;
  /** Whether USPS confirmed this is a deliverable address */
  isValid: boolean;
}

/**
 * Verify and standardize an address using the USPS API (via edge function)
 * then geocode it for lat/lng. Falls back gracefully if USPS is unavailable.
 */
export async function verifyAddress(
  address: string,
  city: string,
  state: string,
  zipCode: string
): Promise<VerifiedAddress> {
  let uspsResult: { normalizedAddress: string; city: string; state: string; zipCode: string; isValid: boolean } | null = null;

  // Layer 1: USPS standardization (via edge function to keep API key server-side).
  // 2026-04-27: send canonical { streetAddress, zipCode } shape. The edge
  // function previously only accepted these field names but both clients
  // were sending { address, zip_code }, so verify silently 400'd for every
  // user. Edge function now accepts either shape too — this is the
  // forward-compatible path.
  try {
    const { data, error } = await supabase.functions.invoke('verify-address', {
      body: { streetAddress: address, city, state, zipCode },
    });
    if (!error && data?.normalized_address) {
      uspsResult = {
        normalizedAddress: data.normalized_address,
        city: data.city,
        state: data.state,
        zipCode: data.zip_code,
        isValid: data.is_valid ?? true,
      };
    }
  } catch {
    // USPS unavailable — fall through to geocoding only
  }

  // Layer 2: Geocode for lat/lng (also provides some normalization via Nominatim)
  let latitude: number | undefined;
  let longitude: number | undefined;
  let geoNormalized: string | undefined;

  try {
    const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
    const geo = await geocodeAddress(fullAddress);
    latitude = geo.latitude;
    longitude = geo.longitude;
    geoNormalized = geo.formattedAddress;
  } catch {
    // Geocoding failed — proceed with USPS result only or raw input
  }

  // Return best available result
  if (uspsResult) {
    return { ...uspsResult, latitude, longitude };
  }

  // No USPS — build a basic normalized form from raw input
  // (uppercase, trim whitespace, standardize common abbreviations)
  const basicNormalized = normalizeAddressLocal(address);
  return {
    normalizedAddress: basicNormalized,
    city: city.trim().toUpperCase(),
    state: state.trim().toUpperCase(),
    zipCode: zipCode.trim().replace(/\s+/g, ''),
    latitude,
    longitude,
    isValid: !!latitude, // If geocoding found it, it's probably real
  };
}

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

// ── Local address normalization (fallback when USPS unavailable) ──

/** Common USPS abbreviation map */
const ABBREVIATIONS: Record<string, string> = {
  'street': 'ST', 'st': 'ST', 'str': 'ST',
  'avenue': 'AVE', 'ave': 'AVE', 'av': 'AVE',
  'boulevard': 'BLVD', 'blvd': 'BLVD',
  'drive': 'DR', 'dr': 'DR', 'drv': 'DR',
  'lane': 'LN', 'ln': 'LN',
  'road': 'RD', 'rd': 'RD',
  'court': 'CT', 'ct': 'CT',
  'circle': 'CIR', 'cir': 'CIR',
  'place': 'PL', 'pl': 'PL',
  'terrace': 'TER', 'ter': 'TER',
  'trail': 'TRL', 'trl': 'TRL',
  'way': 'WAY',
  'parkway': 'PKWY', 'pkwy': 'PKWY',
  'highway': 'HWY', 'hwy': 'HWY',
  'north': 'N', 'n': 'N',
  'south': 'S', 's': 'S',
  'east': 'E', 'e': 'E',
  'west': 'W', 'w': 'W',
  'northeast': 'NE', 'ne': 'NE',
  'northwest': 'NW', 'nw': 'NW',
  'southeast': 'SE', 'se': 'SE',
  'southwest': 'SW', 'sw': 'SW',
  'apartment': 'APT', 'apt': 'APT', 'apt.': 'APT',
  'suite': 'STE', 'ste': 'STE', 'ste.': 'STE',
  'unit': 'UNIT',
  '#': 'APT',
};

/**
 * Best-effort local normalization when USPS API is unavailable.
 * Uppercases, removes periods/commas, standardizes abbreviations.
 */
function normalizeAddressLocal(address: string): string {
  let normalized = address.trim().toUpperCase();

  // Remove periods and commas
  normalized = normalized.replace(/[.,]/g, '');

  // Replace # with APT
  normalized = normalized.replace(/#\s*/g, 'APT ');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  // Replace known words with USPS abbreviations
  const words = normalized.split(' ');
  const result = words.map(word => {
    const lower = word.toLowerCase();
    return ABBREVIATIONS[lower] || word;
  });

  return result.join(' ');
}
