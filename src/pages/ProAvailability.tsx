import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

interface AvailabilityDay {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

const DEFAULT_SCHEDULE: AvailabilityDay[] = [
  { day: 'Monday', enabled: true, start: '8:00 AM', end: '5:00 PM' },
  { day: 'Tuesday', enabled: true, start: '8:00 AM', end: '5:00 PM' },
  { day: 'Wednesday', enabled: true, start: '8:00 AM', end: '5:00 PM' },
  { day: 'Thursday', enabled: true, start: '8:00 AM', end: '5:00 PM' },
  { day: 'Friday', enabled: true, start: '8:00 AM', end: '5:00 PM' },
  { day: 'Saturday', enabled: false, start: '9:00 AM', end: '1:00 PM' },
  { day: 'Sunday', enabled: false, start: '', end: '' },
];

export default function ProAvailability() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [schedule, setSchedule] = useState<AvailabilityDay[]>(DEFAULT_SCHEDULE);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [zipCodes, setZipCodes] = useState<string[]>([]);

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      const { data: provider } = await supabase
        .from('pro_providers')
        .select('*')
        .eq('user_id', authUser.user.id)
        .single();

      if (provider) {
        setProviderId(provider.id);
        setIsAvailable(provider.is_available ?? true);
        setZipCodes(provider.zip_codes || []);
        if (provider.schedule && Array.isArray(provider.schedule)) {
          setSchedule(provider.schedule);
        }
      }
    } catch (err) {
      console.error('Error loading availability:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!providerId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pro_providers')
        .update({
          is_available: isAvailable,
          schedule,
        })
        .eq('id', providerId);

      if (!error) {
        alert('Your availability has been updated.');
      }
    } catch (err) {
      alert('Failed to save availability settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (index: number) => {
    const updated = [...schedule];
    updated[index].enabled = !updated[index].enabled;
    setSchedule(updated);
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/pro-portal')}>
            &larr; Back
          </button>
          <h1>Availability</h1>
          <p className="subtitle">Manage your working status and schedule</p>
        </div>
      </div>

      {/* Active/Inactive Toggle */}
      <div className="card mb-lg">
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div>
            <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: 15 }}>Active Status</p>
            <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>
              {isAvailable ? 'You are active and receiving visit assignments.' : 'You are inactive. No new visits will be assigned.'}
            </p>
          </div>
          <div style={{
            width: 48, height: 26, borderRadius: 13, cursor: 'pointer', position: 'relative',
            backgroundColor: isAvailable ? Colors.success : Colors.medGray, transition: 'background 0.2s',
          }} onClick={() => setIsAvailable(!isAvailable)}>
            <div style={{
              width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
              position: 'absolute', top: 2, left: isAvailable ? 24 : 2, transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </label>
      </div>

      {/* Service Area (read-only) */}
      <div className="card mb-lg" style={{ backgroundColor: Colors.cream }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: 15 }}>Service Area</p>
        <p style={{ margin: '0 0 12px 0', fontSize: 13, color: Colors.medGray }}>
          Your zip codes are managed by your Canopy admin.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {zipCodes.length > 0 ? zipCodes.map(z => (
            <span key={z} style={{
              padding: '4px 10px', borderRadius: 4, fontSize: 13, fontWeight: 500,
              backgroundColor: Colors.sageMuted, color: Colors.sage,
            }}>{z}</span>
          )) : (
            <span style={{ fontSize: 13, color: Colors.medGray, fontStyle: 'italic' }}>No zip codes assigned</span>
          )}
        </div>
      </div>

      {/* Working Days */}
      <div className="card mb-lg">
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: 15 }}>Working Days</p>
        <p style={{ margin: '0 0 16px 0', fontSize: 13, color: Colors.medGray }}>
          Toggle the days you're available for visits
        </p>

        {schedule.map((day, index) => (
          <div
            key={day.day}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              paddingBottom: 12, marginBottom: 12,
              borderBottom: index < schedule.length - 1 ? `1px solid ${Colors.lightGray}` : 'none',
            }}
          >
            <button
              onClick={() => toggleDay(index)}
              style={{
                width: 44, height: 44, padding: 0, minWidth: 44, borderRadius: 8,
                backgroundColor: day.enabled ? Colors.sage : Colors.lightGray,
                color: day.enabled ? 'white' : Colors.medGray,
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}
            >
              {day.day.slice(0, 3)}
            </button>
            <p style={{ margin: 0, flex: 1, color: day.enabled ? Colors.charcoal : Colors.medGray }}>
              {day.enabled ? `${day.start || '—'} — ${day.end || '—'}` : 'Off'}
            </p>
          </div>
        ))}
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/pro-portal')}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Availability'}
        </button>
      </div>
    </div>
  );
}
