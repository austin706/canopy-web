import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

interface ServiceAreaMapProps {
  userZip?: string;
  compact?: boolean;
}

interface AreaInfo {
  zip_code: string;
  city_name: string | null;
  state: string;
  region_name: string | null;
  is_active: boolean;
}

interface CityGroup {
  city: string;
  zips: string[];
}

// Approximate lat/lng for Tulsa metro cities (for visual map positioning)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Tulsa': { lat: 36.154, lng: -95.993 },
  'Broken Arrow': { lat: 36.060, lng: -95.795 },
  'Owasso': { lat: 36.270, lng: -95.855 },
  'Bixby': { lat: 35.942, lng: -95.883 },
  'Jenks': { lat: 35.994, lng: -95.968 },
  'Sand Springs': { lat: 36.140, lng: -96.109 },
  'Sapulpa': { lat: 35.999, lng: -96.114 },
  'Glenpool': { lat: 35.955, lng: -95.991 },
  'Catoosa': { lat: 36.190, lng: -95.746 },
  'Coweta': { lat: 35.952, lng: -95.651 },
  'Inola': { lat: 36.151, lng: -95.509 },
  'Sperry': { lat: 36.297, lng: -95.986 },
};

// Map bounds for Tulsa metro
const MAP_BOUNDS = {
  minLat: 35.85,
  maxLat: 36.38,
  minLng: -96.25,
  maxLng: -95.40,
};

function latLngToXY(lat: number, lng: number, width: number, height: number) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * width;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * height;
  return { x, y };
}

export default function ServiceAreaMap({ userZip, compact = false }: ServiceAreaMapProps) {
  const [areas, setAreas] = useState<AreaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkZip, setCheckZip] = useState(userZip || '');
  const [checkResult, setCheckResult] = useState<'available' | 'unavailable' | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('service_areas')
        .select('zip_code, city_name, state, region_name, is_active')
        .eq('is_active', true)
        .order('city_name')
        .order('zip_code');

      if (error) throw error;
      setAreas(data || []);
    } catch (err) {
      console.error('Error loading service areas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckZip = async () => {
    if (!checkZip || checkZip.length < 5) return;

    const zip = checkZip.trim().substring(0, 5);
    const { data, error } = await supabase
      .from('service_areas')
      .select('zip_code')
      .eq('zip_code', zip)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error checking zip:', error);
      return;
    }

    setCheckResult(data && data.length > 0 ? 'available' : 'unavailable');
  };

  // Group areas by city
  const cityGroups: CityGroup[] = [];
  const cityMap = new Map<string, string[]>();
  areas.forEach(a => {
    const city = a.city_name || 'Unknown';
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(a.zip_code);
  });
  cityMap.forEach((zips, city) => {
    cityGroups.push({ city, zips: zips.sort() });
  });
  cityGroups.sort((a, b) => a.city.localeCompare(b.city));

  const totalZips = areas.length;
  const totalCities = cityGroups.length;
  const userZipAvailable = userZip ? areas.some(a => a.zip_code === userZip.trim().substring(0, 5)) : null;

  const mapWidth = compact ? 280 : 400;
  const mapHeight = compact ? 200 : 280;

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: Colors.medGray }}>
        Loading service areas...
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Visual Map */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: mapWidth,
        height: mapHeight,
        margin: compact ? '0 auto 12px' : '0 auto 20px',
        background: `linear-gradient(135deg, #f0f7ed 0%, #e8f0e4 100%)`,
        borderRadius: 16,
        border: `1px solid ${Colors.sage}40`,
        overflow: 'hidden',
      }}>
        {/* Map title */}
        <div style={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: Colors.sage,
          zIndex: 2,
        }}>
          Tulsa Metro Service Area
        </div>

        {/* City dots and labels */}
        <svg width="100%" height="100%" viewBox={`0 0 ${mapWidth} ${mapHeight}`} style={{ position: 'absolute', top: 0, left: 0 }}>
          {/* Connection lines from Tulsa to surrounding cities */}
          {Object.entries(CITY_COORDS).filter(([name]) => name !== 'Tulsa').map(([name, coords]) => {
            const tulsa = CITY_COORDS['Tulsa'];
            const from = latLngToXY(tulsa.lat, tulsa.lng, mapWidth, mapHeight);
            const to = latLngToXY(coords.lat, coords.lng, mapWidth, mapHeight);
            return (
              <line
                key={`line-${name}`}
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke={Colors.sage}
                strokeWidth={1}
                strokeOpacity={0.2}
                strokeDasharray="4 3"
              />
            );
          })}

          {/* City markers */}
          {Object.entries(CITY_COORDS).map(([name, coords]) => {
            const { x, y } = latLngToXY(coords.lat, coords.lng, mapWidth, mapHeight);
            const isTulsa = name === 'Tulsa';
            const isHovered = hoveredCity === name;
            const cityZipCount = cityMap.get(name)?.length || 0;
            const radius = isTulsa ? 10 : isHovered ? 7 : 5;

            return (
              <g
                key={name}
                onMouseEnter={() => setHoveredCity(name)}
                onMouseLeave={() => setHoveredCity(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulse ring for Tulsa */}
                {isTulsa && (
                  <circle cx={x} cy={y} r={16} fill={Colors.sage} opacity={0.1}>
                    <animate attributeName="r" from="12" to="22" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.15" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Dot */}
                <circle
                  cx={x} cy={y} r={radius}
                  fill={isHovered ? Colors.copper : Colors.sage}
                  stroke="#fff"
                  strokeWidth={isTulsa ? 2.5 : 1.5}
                  style={{ transition: 'all 0.15s ease' }}
                />

                {/* Label */}
                <text
                  x={x}
                  y={y - radius - 4}
                  textAnchor="middle"
                  fontSize={isTulsa ? 11 : isHovered ? 10 : 8}
                  fontWeight={isTulsa || isHovered ? 700 : 500}
                  fill={isHovered ? Colors.copper : Colors.charcoal}
                  style={{ transition: 'all 0.15s ease' }}
                >
                  {name}
                </text>

                {/* ZIP count on hover */}
                {isHovered && (
                  <text
                    x={x}
                    y={y + radius + 12}
                    textAnchor="middle"
                    fontSize={9}
                    fill={Colors.medGray}
                    fontWeight={600}
                  >
                    {cityZipCount} ZIP{cityZipCount !== 1 ? 's' : ''}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Stats badge */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          fontSize: 10,
          color: Colors.medGray,
          background: 'rgba(255,255,255,0.85)',
          padding: '3px 8px',
          borderRadius: 6,
        }}>
          {totalCities} cities · {totalZips} ZIP codes
        </div>
      </div>

      {/* City badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: compact ? 12 : 16 }}>
        {cityGroups.map(group => (
          <div
            key={group.city}
            onMouseEnter={() => setHoveredCity(group.city)}
            onMouseLeave={() => setHoveredCity(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              borderRadius: 16,
              background: hoveredCity === group.city ? `${Colors.copper}15` : `${Colors.sage}10`,
              border: `1px solid ${hoveredCity === group.city ? Colors.copper : Colors.sage}40`,
              cursor: 'default',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: hoveredCity === group.city ? Colors.copper : Colors.sage,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal }}>
              {group.city}
            </span>
            <span style={{ fontSize: 10, color: Colors.medGray }}>
              {group.zips.length}
            </span>
          </div>
        ))}
      </div>

      {/* User's ZIP status */}
      {userZipAvailable !== null && (
        <div style={{
          marginBottom: compact ? 12 : 16,
          padding: '8px 12px',
          borderRadius: 8,
          background: userZipAvailable ? `${Colors.sage}15` : '#FFF3E0',
          color: userZipAvailable ? '#2E7D32' : '#E65100',
          fontSize: 13,
          fontWeight: 500,
        }}>
          {userZipAvailable
            ? `✓ Your ZIP code (${userZip}) is in our service area!`
            : `Your ZIP code (${userZip}) is not in our service area yet.`
          }
        </div>
      )}

      {/* Zip code checker */}
      <div style={{
        background: '#f9f9f7',
        borderRadius: 12,
        padding: compact ? 14 : 18,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>
          Check your area
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Enter 5-digit ZIP code"
            value={checkZip}
            onChange={e => {
              setCheckZip(e.target.value.replace(/\D/g, '').slice(0, 5));
              setCheckResult(null);
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleCheckZip(); }}
            maxLength={5}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleCheckZip}
            disabled={!checkZip || checkZip.length < 5}
          >
            Check
          </button>
        </div>

        {checkResult === 'available' && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            background: `${Colors.sage}20`,
            color: '#2E7D32',
            fontSize: 13,
            fontWeight: 500,
          }}>
            ✓ Pro services are available in your area! You can upgrade to Home Pro or Home Pro+.
          </div>
        )}

        {checkResult === 'unavailable' && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            background: '#FFF3E0',
            color: '#E65100',
            fontSize: 13,
            fontWeight: 500,
          }}>
            Pro services aren't available in your area yet. Join the waitlist to be notified when we expand!
          </div>
        )}
      </div>
    </div>
  );
}
