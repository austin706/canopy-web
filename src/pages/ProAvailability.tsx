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
  const [serviceAreaMiles, setServiceAreaMiles] = useState(25);
  const [maxJobsPerDay, setMaxJobsPerDay] = useState(4);
  const [providerId, setProviderId] = useState<string | null>(null);

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
        setServiceAreaMiles(provider.service_area_miles ?? 25);
        setMaxJobsPerDay(provider.max_jobs_per_day ?? 4);
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
          service_area_miles: serviceAreaMiles,
          max_jobs_per_day: maxJobsPerDay,
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

  const adjustValue = (current: number, delta: number, min: number, max: number) => {
    const newVal = current + delta;
    return newVal >= min && newVal <= max ? newVal : current;
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/pro-portal')}>
            ← Back
          </button>
          <h1>Availability</h1>
        </div>
      </div>

      {/* Overall Availability Toggle */}
      <div className="card">
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div>
            <p style={{ margin: '0 0 4px 0', fontWeight: 500 }}>Accepting New Jobs</p>
            <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>
              Turn off to stop receiving new service requests
            </p>
          </div>
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={e => setIsAvailable(e.target.checked)}
            style={{ width: 20, height: 20, cursor: 'pointer' }}
          />
        </label>
      </div>

      {/* Service Area */}
      <div className="card">
        <p style={{ margin: '0 0 16px 0', fontWeight: 500 }}>Service Area</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setServiceAreaMiles(adjustValue(serviceAreaMiles, -5, 5, 100))}
            style={{ fontSize: 20, width: 40, height: 40, padding: 0 }}
          >
            −
          </button>
          <div style={{ textAlign: 'center', minWidth: 100 }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: Colors.sage }}>
              {serviceAreaMiles}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>miles</p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => setServiceAreaMiles(adjustValue(serviceAreaMiles, 5, 5, 100))}
            style={{ fontSize: 20, width: 40, height: 40, padding: 0 }}
          >
            +
          </button>
        </div>
      </div>

      {/* Max Jobs Per Day */}
      <div className="card">
        <p style={{ margin: '0 0 16px 0', fontWeight: 500 }}>Max Jobs Per Day</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setMaxJobsPerDay(adjustValue(maxJobsPerDay, -1, 1, 10))}
            style={{ fontSize: 20, width: 40, height: 40, padding: 0 }}
          >
            −
          </button>
          <div style={{ textAlign: 'center', minWidth: 100 }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: Colors.sage }}>
              {maxJobsPerDay}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>jobs</p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => setMaxJobsPerDay(adjustValue(maxJobsPerDay, 1, 1, 10))}
            style={{ fontSize: 20, width: 40, height: 40, padding: 0 }}
          >
            +
          </button>
        </div>
      </div>

      {/* Weekly Schedule */}
      <div className="card">
        <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Weekly Schedule</p>
        <p style={{ margin: '0 0 16px 0', fontSize: 13, color: Colors.medGray }}>
          Toggle days you're available for service calls
        </p>

        {schedule.map((day, index) => (
          <div
            key={day.day}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingBottom: 12,
              marginBottom: 12,
              borderBottom: index < schedule.length - 1 ? `1px solid ${Colors.lightGray}` : 'none',
            }}
          >
            <button
              className={`btn ${day.enabled ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => toggleDay(index)}
              style={{
                width: 44,
                height: 44,
                padding: 0,
                minWidth: 44,
                backgroundColor: day.enabled ? Colors.sage : Colors.lightGray,
                color: day.enabled ? 'white' : Colors.medGray,
                border: 'none',
              }}
            >
              {day.day.slice(0, 3)}
            </button>
            <p style={{ margin: 0, flex: 1, color: day.enabled ? Colors.charcoal : Colors.silver }}>
              {day.enabled ? `${day.start || '—'} – ${day.end || '—'}` : 'Off'}
            </p>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex gap-sm">
        <button className="btn btn-ghost" onClick={() => navigate('/pro-portal')}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Availability'}
        </button>
      </div>
    </div>
  );
}
