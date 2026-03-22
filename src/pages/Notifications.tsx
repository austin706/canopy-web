import { useState, useEffect } from 'react';
import { Colors } from '@/constants/theme';

interface NotificationPreferences {
  taskReminders: boolean;
  weatherAlerts: boolean;
  equipmentLifecycle: boolean;
  reminderTiming: 'day_of' | '1_day_before' | '3_days_before';
}

const DEFAULT_PREFS: NotificationPreferences = {
  taskReminders: true,
  weatherAlerts: true,
  equipmentLifecycle: true,
  reminderTiming: 'day_of',
};

export default function Notifications() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('notificationPreferences');
    if (stored) {
      try {
        setPrefs(JSON.parse(stored));
      } catch (err) {
        console.warn('Failed to parse stored preferences');
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('notificationPreferences', JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggle = (key: keyof Omit<NotificationPreferences, 'reminderTiming'>) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="subtitle">Manage your notification preferences</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Notification Types */}
        <div className="card mb-lg">
          <p style={{ fontWeight: 600, marginBottom: 16 }}>Notification Types</p>
          <div className="flex-col gap-md">
            {/* Task Reminders */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 16,
              borderBottom: `1px solid ${Colors.lightGray}`
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>Task Reminders</p>
                <p className="text-xs text-gray">Get reminded about upcoming maintenance tasks</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.taskReminders}
                onChange={() => toggle('taskReminders')}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>

            {/* Weather Alerts */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 16,
              borderBottom: `1px solid ${Colors.lightGray}`
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>Weather Alerts</p>
                <p className="text-xs text-gray">Notifications about severe weather events</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.weatherAlerts}
                onChange={() => toggle('weatherAlerts')}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>

            {/* Equipment Lifecycle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>Equipment Lifecycle Warnings</p>
                <p className="text-xs text-gray">Alerts when equipment is nearing end of life</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.equipmentLifecycle}
                onChange={() => toggle('equipmentLifecycle')}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Reminder Timing */}
        <div className="card mb-lg">
          <p style={{ fontWeight: 600, marginBottom: 16 }}>Reminder Timing</p>
          <div className="flex-col gap-sm">
            {['day_of', '1_day_before', '3_days_before'].map(timing => (
              <label
                key={timing}
                style={{
                  padding: '12px 16px',
                  borderRadius: 4,
                  border: `1.5px solid ${prefs.reminderTiming === timing ? Colors.copper : Colors.lightGray}`,
                  background: prefs.reminderTiming === timing ? Colors.copperMuted : Colors.cream,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <input
                  type="radio"
                  name="reminderTiming"
                  value={timing}
                  checked={prefs.reminderTiming === timing}
                  onChange={(e) => setPrefs(prev => ({ ...prev, reminderTiming: e.target.value as any }))}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ color: Colors.charcoal, fontWeight: 500 }}>
                  {timing === 'day_of' && 'Day of task'}
                  {timing === '1_day_before' && '1 day before'}
                  {timing === '3_days_before' && '3 days before'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Save Section */}
        <div>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            style={{ width: '100%', marginBottom: 12 }}
          >
            Save Preferences
          </button>
          {saved && (
            <p style={{ textAlign: 'center', fontSize: 12, color: Colors.success, fontWeight: 600 }}>
              ✓ Preferences saved
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
