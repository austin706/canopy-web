// ═══════════════════════════════════════════════════════════════
// Geocoding Service — Address ↔ Coordinates (Web)
// ═══════════════════════════════════════════════════════════════

/**
 * Geocode an address to coordinates using OpenStreetMap Nominatim API (free, no key needed)
 * Returns { latitude, longitude, formattedAddress } or throws on error
 */
export const geocodeAddress = async (address: string): Promise<{
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
}> => {
  if (!address || address.trim().length === 0) {
    throw new Error('Address is required');
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'CanopyApp/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding API returned status ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('Address not found');
    }

    const result = data[0];
    const { address: addressObj } = result;

    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedAddress: result.display_name,
      city: addressObj?.city || addressObj?.town || addressObj?.village || '',
      state: addressObj?.state || '',
      country: addressObj?.country || '',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to geocode address');
  }
};

/**
 * Reverse geocode coordinates to a human-readable address using OpenStreetMap Nominatim
 */
export const reverseGeocode = async (latitude: number, longitude: number): Promise<{
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
}> => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid latitude and longitude are required');
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      {
        headers: {
          'User-Agent': 'CanopyApp/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reverse geocoding API returned status ${response.status}`);
    }

    const result = await response.json();

    if (!result || !result.display_name) {
      throw new Error('Unable to find address for coordinates');
    }

    const { address: addressObj } = result;

    return {
      formattedAddress: result.display_name,
      city: addressObj?.city || addressObj?.town || addressObj?.village || '',
      state: addressObj?.state || '',
      country: addressObj?.country || '',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to reverse geocode');
  }
};

/**
 * Parse a formatted address string into components
 * Expects format like "123 Main St, City, State 12345"
 */
export const parseAddress = (fullAddress: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} => {
  // Simple parsing — split by comma and try to extract parts
  const parts = fullAddress.split(',').map(p => p.trim());

  // Try to find zip code (5 digits, optionally +4)
  const lastPart = parts[parts.length - 1] || '';
  const zipMatch = lastPart.match(/\d{5}(-\d{4})?/);
  const zip = zipMatch ? zipMatch[0] : '';

  // Remove zip from last part
  const stateAndCity = lastPart.replace(zip, '').trim();

  return {
    street: parts[0] || '',
    city: parts[1] || '',
    state: stateAndCity || parts[parts.length - 2] || '',
    zip,
  };
};

/**
 * Validate address format (basic check)
 */
export const validateAddressFormat = (address: string): boolean => {
  // Must have at least some characters and not just spaces
  return !!address && address.trim().length >= 5;
};
