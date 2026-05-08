// Address input with Google Places autocomplete dropdown.
// Gracefully falls back to a plain text input if the edge function
// is unavailable (no API key, offline, etc.).

import { useEffect, useRef, useState } from 'react';
import {
  fetchPlacePredictions,
  fetchPlaceDetails,
  newPlacesSessionToken,
  type PlacePrediction,
  type PlaceDetails,
} from '@/services/placesAutocomplete';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (details: PlaceDetails) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = '123 Oak Street',
  disabled,
  className = 'form-input',
  autoFocus,
  ariaLabel = 'Street address',
}: Props) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const sessionTokenRef = useRef<string>(newPlacesSessionToken());
  const debounceRef = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced prediction fetch
  useEffect(() => {
    if (!value || value.trim().length < 3) {
      setPredictions([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      const preds = await fetchPlacePredictions(value, sessionTokenRef.current);
      setPredictions(preds);
      setLoading(false);
      setShowDropdown(preds.length > 0);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = async (prediction: PlacePrediction) => {
    setShowDropdown(false);
    setPredictions([]);
    onChange(prediction.mainText || prediction.fullText);

    // 2026-05-07 v2: harder fallback. Parses both secondaryText and fullText,
    // maps full state names to abbreviations. See mobile mirror for the why.
    const fallback = parseAddressFromPrediction(prediction);
    // eslint-disable-next-line no-console
    console.log('[AddressAutocomplete] handleSelect', { prediction, fallback });
    if (onPlaceSelected) {
      onPlaceSelected({
        placeId: prediction.placeId,
        address: prediction.mainText || prediction.fullText,
        city: fallback.city,
        state: fallback.state,
        zipCode: fallback.zipCode,
        formatted: prediction.fullText,
      });
    }

    try {
      const details = await fetchPlaceDetails(prediction.placeId, sessionTokenRef.current);
      // eslint-disable-next-line no-console
      console.debug('[AddressAutocomplete] place details response:', { placeId: prediction.placeId, details });
      if (details && onPlaceSelected) {
        // Only override fallback fields if details has real values; never
        // clobber a populated fallback with an empty details field.
        onPlaceSelected({
          placeId: details.placeId || prediction.placeId,
          address: details.address || prediction.mainText || prediction.fullText,
          city: details.city || fallback.city,
          state: details.state || fallback.state,
          zipCode: details.zipCode || fallback.zipCode,
          latitude: details.latitude,
          longitude: details.longitude,
          formatted: details.formatted || prediction.fullText,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[AddressAutocomplete] place details fetch failed; using prediction fallback:', err);
    }
    // New session token after a successful details lookup
    sessionTokenRef.current = newPlacesSessionToken();
  };

  // 2026-05-07 v2: parse address parts out of a Google Places prediction.
  // Tries secondaryText first ("Tulsa, OK, USA"), falls back to the tail of
  // fullText if secondary is empty ("3003 W 77th St, Tulsa, OK 74103, USA"),
  // and converts full state names to abbreviations so the form's State
  // input gets the 2-letter code it expects.
  function parseAddressFromPrediction(prediction: PlacePrediction): { city: string; state: string; zipCode: string } {
    // First try secondaryText (most predictions have this)
    let result = parseLocalityChunk(prediction.secondaryText);
    if (result.city && result.state) return result;

    // Fall back: parse fullText, drop the first comma-separated chunk
    // (the street address), and treat the rest as the locality chunk.
    const full = prediction.fullText || '';
    const firstComma = full.indexOf(',');
    if (firstComma > 0 && firstComma < full.length - 1) {
      const tail = full.substring(firstComma + 1).trim();
      const tailParsed = parseLocalityChunk(tail);
      // Merge — keep whatever secondaryText gave us, fill gaps from fullText
      result = {
        city: result.city || tailParsed.city,
        state: result.state || tailParsed.state,
        zipCode: result.zipCode || tailParsed.zipCode,
      };
    }
    return result;
  }

  // Internal: parse a "City, State [ZIP], USA" chunk into pieces.
  function parseLocalityChunk(chunk: string): { city: string; state: string; zipCode: string } {
    const result = { city: '', state: '', zipCode: '' };
    if (!chunk) return result;
    // Strip trailing ", USA" / ", United States"
    const trimmed = chunk
      .replace(/,\s*(USA|United\s+States(?:\s+of\s+America)?)\s*$/i, '')
      .trim();
    const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return result;
    if (parts.length === 1) {
      // Single chunk — treat as state + maybe zip
      result.state = stateToAbbrev(parts[0].split(/\s+/)[0] ?? '');
      return result;
    }
    result.city = parts[0];
    // Last part: "State", "State 12345", "Oklahoma", "Oklahoma 74103", etc.
    const last = parts[parts.length - 1];
    // Try to peel a 5-digit ZIP off the end first
    const zipMatch = last.match(/(\d{5}(?:-\d{4})?)\s*$/);
    if (zipMatch) {
      result.zipCode = zipMatch[1].split('-')[0];
    }
    // Then take the rest as the state name (could be "OK" or "Oklahoma")
    const stateText = last.replace(/(\d{5}(?:-\d{4})?)\s*$/, '').trim();
    if (stateText) {
      result.state = stateToAbbrev(stateText);
    }
    return result;
  }

  // US state name → 2-letter abbreviation. Returns input unchanged if
  // already an abbreviation or unrecognized. Case-insensitive.
  function stateToAbbrev(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    if (trimmed.length === 2) return trimmed.toUpperCase();
    const map: Record<string, string> = {
      alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
      colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
      hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
      kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
      massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
      montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
      oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
      virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
      'district of columbia': 'DC',
    };
    const looked = map[trimmed.toLowerCase()];
    return looked ?? trimmed;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(predictions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        className={className}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        // 2026-05-07: was `street-address` (single-field WHATWG token meaning
        // "the entire address in one input"). Browsers' contact-card autofill
        // dumped the whole address into just this field. For a multi-field
        // form (we have separate City/State/ZIP inputs) the correct token is
        // `address-line1`; the other three inputs get `address-level2` (city),
        // `address-level1` (state), and `postal-code` so the browser can
        // distribute the parts across all four.
        autoComplete="address-line1"
        name="address-line1"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && predictions.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: 280,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #d4d4d4',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {predictions.map((p, idx) => (
            <li
              key={p.placeId}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(p);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                background: idx === activeIndex ? '#f5f2ea' : 'transparent',
                borderBottom: idx < predictions.length - 1 ? '1px solid #f0f0f0' : 'none',
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500, color: '#2d3319' }}>{p.mainText}</div>
              {p.secondaryText && (
                <div style={{ fontSize: 12, color: '#6b6b6b', marginTop: 2 }}>
                  {p.secondaryText}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: '#8b9e7e',
            pointerEvents: 'none',
          }}
        >
          Searching…
        </div>
      )}
    </div>
  );
}
