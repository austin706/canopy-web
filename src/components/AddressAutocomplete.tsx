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
    const details = await fetchPlaceDetails(prediction.placeId, sessionTokenRef.current);
    if (details && onPlaceSelected) onPlaceSelected(details);
    // New session token after a successful details lookup
    sessionTokenRef.current = newPlacesSessionToken();
  };

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
