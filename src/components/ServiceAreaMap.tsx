import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

interface ServiceAreaMapProps {
  userZip?: string;
  compact?: boolean;
}

interface AreaInfo {
  state: string;
  region_name: string | null;
  count: number;
}

export default function ServiceAreaMap({ userZip, compact = false }: ServiceAreaMapProps) {
  const [areas, setAreas] = useState<AreaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkZip, setCheckZip] = useState(userZip || '');
  const [checkResult, setCheckResult] = useState<'available' | 'unavailable' | null>(null);

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('service_areas')
        .select('state, region_name')
        .eq('is_active', true);

      if (error) throw error;

      // Group by state
      const grouped = (data || []).reduce((acc, row) => {
        const existing = acc.find(a => a.state === row.state);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ state: row.state, region_name: row.region_name, count: 1 });
        }
        return acc;
      }, [] as AreaInfo[]);

      setAreas(grouped);
    } catch (err) {
      console.error('Error loading service areas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckZip = async () => {
    if (!checkZip || checkZip.length < 3) return;

    const prefix = checkZip.trim().substring(0, 3);
    const { data, error } = await supabase
      .from('service_areas')
      .select('id')
      .eq('zip_prefix', prefix)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error checking zip:', error);
      return;
    }

    setCheckResult(data && data.length > 0 ? 'available' : 'unavailable');
  };

  const activeStates = areas.map(a => a.state);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: Colors.medGray }}>
        Loading service areas...
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* State badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: compact ? 12 : 20 }}>
        {areas.length === 0 ? (
          <p style={{ fontSize: 14, color: Colors.medGray }}>No active service areas</p>
        ) : (
          areas.sort((a, b) => a.state.localeCompare(b.state)).map(area => (
            <div
              key={area.state}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 20,
                background: `${Colors.sage}15`,
                border: `1px solid ${Colors.sage}`,
              }}
            >
              <span style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: Colors.sage,
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>
                {area.region_name || area.state}
              </span>
              <span style={{ fontSize: 12, color: Colors.medGray }}>
                {area.count} zip{area.count !== 1 ? 's' : ''}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Zip code checker */}
      <div style={{
        background: '#f9f9f7',
        borderRadius: 12,
        padding: compact ? 16 : 20,
      }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>
          Check your area
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Enter zip code"
            value={checkZip}
            onChange={e => {
              setCheckZip(e.target.value.replace(/\D/g, '').slice(0, 5));
              setCheckResult(null);
            }}
            maxLength={5}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleCheckZip}
            disabled={!checkZip || checkZip.length < 3}
          >
            Check
          </button>
        </div>

        {checkResult === 'available' && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: `${Colors.sage}20`,
            color: '#2E7D32',
            fontSize: 14,
            fontWeight: 500,
          }}>
            Pro services are available in your area! You can upgrade to Home Pro or Home Pro+.
          </div>
        )}

        {checkResult === 'unavailable' && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#FFF3E0',
            color: '#E65100',
            fontSize: 14,
            fontWeight: 500,
          }}>
            Pro services aren't available in your area yet. Join the waitlist to be notified when we expand!
          </div>
        )}
      </div>
    </div>
  );
}
