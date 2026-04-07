import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the module under test
vi.mock('@/services/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { fetchPlacePredictions, fetchPlaceDetails, newPlacesSessionToken } from './placesAutocomplete';
import { supabase } from '@/services/supabase';

const mockInvoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe('placesAutocomplete', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('returns [] for inputs under 3 characters without calling the edge function', async () => {
    const result = await fetchPlacePredictions('ab', 'token-1');
    expect(result).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('maps edge function predictions to PlacePrediction objects', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        predictions: [
          { placeId: 'p1', mainText: '123 Main St', secondaryText: 'Tulsa, OK', fullText: '123 Main St, Tulsa, OK' },
        ],
      },
      error: null,
    });
    const result = await fetchPlacePredictions('123 Main', 'token-1');
    expect(result).toHaveLength(1);
    expect(result[0].placeId).toBe('p1');
    expect(mockInvoke).toHaveBeenCalledWith('places-autocomplete', {
      body: { mode: 'autocomplete', input: '123 Main', sessionToken: 'token-1' },
    });
  });

  it('returns [] and swallows errors when the edge function fails', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const result = await fetchPlacePredictions('123 Main St', 'token-1');
    expect(result).toEqual([]);
  });

  it('returns null from fetchPlaceDetails on error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const result = await fetchPlaceDetails('p1', 'token-1');
    expect(result).toBeNull();
  });

  it('generates a well-formed session token', () => {
    const token = newPlacesSessionToken();
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
