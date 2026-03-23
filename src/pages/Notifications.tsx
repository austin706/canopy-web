import React, { useState, useEffect, useRef } from 'react';
import { Colors } from '@/constants/theme';
import { CheckCircleIcon, StormIcon, GearIcon, WrenchIcon, BellIcon } from '@/components/icons/Icons';
import { useStore } from '@/store/useStore';
import * as supabaseService from '@/services/supabase';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  data?: any;
  created_at: string;
}

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

const NOTIFICATION_ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  task: CheckCircleIcon,
  weather: StormIcon,
  equipment: GearIcon,
  pro_service: WrenchIcon,
  general: BellIcon,
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

export default function Notifications() {
  const { user } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'settings'>('feed');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [notifs, storedPrefs] = await Promise.all([
          supabaseService.getNotifications(user.id),
          supabaseService.getNotificationPreferences(user.id),
        ]);
        setNotifications(notifs);
        if (storedPrefs) setPrefs(storedPrefs);
      } catch (err) {
        console.error('Failed to load notification data:', err);
        setError('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  const handleMarkRead = async (id: string) => {
    try {
      await supabaseService.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await supabaseService.markAllNotificationsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    try {
      setError(null);
      await supabaseService.updateNotificationPreferences(user.id, prefs);
      setSaved(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save preferences. Please try again.');
    }
  };

  const toggle = (key: keyof Omit<NotificationPreferences, 'reminderTiming'>) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><h1>Notifications</h1></div>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="card"><p style={{ textAlign: 'center', color: Colors.charcoal }}>Loading...</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="subtitle">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {error && (
          <div className="card" style={{ backgroundColor: '#ffebee', borderLeft: `4px solid ${Colors.error || '#d32f2f'}`, marginBottom: 16 }}>
            <p style={{ color: '#d32f2f', fontSize: 14 }}>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs mb-lg">
          <button className={`tab ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}>
            Feed {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            Settings
          </button>
        </div>

        {activeTab === 'feed' && (
          <>
            {/* Mark All Read */}
            {unreadCount > 0 && (
              <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead} style={{ fontSize: 12, color: Colors.sage }}>
                  Mark all as read
                </button>
              </div>
            )}

            {/* Notification Feed */}
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: 48 }}>
                <div style={{ marginBottom: 12 }}><BellIcon size={40} color={Colors.medGray} /></div>
                <h3 style={{ marginBottom: 6 }}>No Notifications Yet</h3>
                <p className="text-gray">Notifications about tasks, weather, and services will appear here.</p>
              </div>
            ) : (
              <div className="flex-col gap-sm">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className="card"
                    onClick={() => !n.read && handleMarkRead(n.id)}
                    style={{
                      padding: '14px 16px',
                      cursor: n.read ? 'default' : 'pointer',
                      opacity: n.read ? 0.7 : 1,
                      borderLeft: n.read ? 'none' : `3px solid ${Colors.sage}`,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0, display: 'flex' }}>{React.createElement(NOTIFICATION_ICON_MAP[n.type] || NOTIFICATION_ICON_MAP.general, { size: 20, color: Colors.copper })}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <p style={{ fontWeight: n.read ? 500 : 600, fontSize: 14, color: Colors.charcoal }}>{n.title}</p>
                          <span className="text-xs text-gray">{timeAgo(n.created_at)}</span>
                        </div>
                        {n.body && <p className="text-sm text-gray" style={{ margin: 0 }}>{n.body}</p>}
                      </div>
                      {!n.read && (
                        <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.sage, flexShrink: 0, marginTop: 6 }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'settings' && (
          <>
            {/* Notification Types */}
            <div className="card mb-lg">
              <p style={{ fontWeight: 600, marginBottom: 16 }}>Notification Types</p>
              <div className="flex-col gap-md">
                {[
                  { key: 'taskReminders' as const, label: 'Task Reminders', desc: 'Get reminded about upcoming maintenance tasks' },
                  { key: 'weatherAlerts' as const, label: 'Weather Alerts', desc: 'Notifications about severe weather events' },
                  { key: 'equipmentLifecycle' as const, label: 'Equipment Lifecycle Warnings', desc: 'Alerts when equipment is nearing end of life' },
                ].map((item, i, arr) => (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingBottom: i < arr.length - 1 ? 16 : 0,
                    borderBottom: i < arr.length - 1 ? `1px solid ${Colors.lightGray}` : 'none',
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>{item.label}</p>
                      <p className="text-xs text-gray">{item.desc}</p>
                    </div>
                    <input type="checkbox" checked={prefs[item.key]} onChange={() => toggle(item.key)} style={{ width: 20, height: 20, cursor: 'pointer' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Reminder Timing */}
            <div className="card mb-lg">
              <p style={{ fontWeight: 600, marginBottom: 16 }}>Reminder Timing</p>
              <div className="flex-col gap-sm">
                {[
                  { value: 'day_of', label: 'Day of task' },
                  { value: '1_day_before', label: '1 day before' },
                  { value: '3_days_before', label: '3 days before' },
                ].map(timing => (
                  <label key={timing.value} style={{
                    padding: '12px 16px', borderRadius: 4,
                    border: `1.5px solid ${prefs.reminderTiming === timing.value ? Colors.copper : Colors.lightGray}`,
                    background: prefs.reminderTiming === timing.value ? Colors.copperMuted : Colors.cream,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <input type="radio" name="reminderTiming" value={timing.value} checked={prefs.reminderTiming === timing.value}
                      onChange={(e) => setPrefs(prev => ({ ...prev, reminderTiming: e.target.value as any }))} style={{ cursor: 'pointer' }} />
                    <span style={{ color: Colors.charcoal, fontWeight: 500 }}>{timing.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save */}
            <div>
              <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', marginBottom: 12 }}>Save Preferences</button>
              {saved && <p style={{ textAlign: 'center', fontSize: 12, color: Colors.success, fontWeight: 600 }}>{'\u2713'} Preferences saved</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
