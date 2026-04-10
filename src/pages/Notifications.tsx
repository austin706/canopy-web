import React, { useState, useEffect, useRef } from 'react';
import { Colors } from '@/constants/theme';
import { CheckCircleIcon, StormIcon, GearIcon, WrenchIcon, BellIcon } from '@/components/icons/Icons';
import { useStore } from '@/store/useStore';
import * as supabaseService from '@/services/supabase';
import {
  NotificationItem,
  NotificationCategory,
  CategoryChannelPrefs,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFS,
  DigestFrequency,
} from '@/types';

const NOTIFICATION_ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  // Preference keys (used in settings)
  home_maintenance: CheckCircleIcon,
  weather_safety: StormIcon,
  equipment_lifecycle: GearIcon,
  pro_services: WrenchIcon,
  account_billing: BellIcon,
  // DB category values (used in feed)
  task: CheckCircleIcon,
  weather: StormIcon,
  equipment: GearIcon,
  pro_visit: WrenchIcon,
  pro_quote: WrenchIcon,
  pro_invoice: BellIcon,
  payment: BellIcon,
  subscription: BellIcon,
  general: BellIcon,
};

const CATEGORY_INFO: Record<string, { label: string; desc: string }> = {
  home_maintenance: {
    label: 'Home Maintenance',
    desc: 'Task reminders, due dates, and completions',
  },
  weather_safety: {
    label: 'Weather & Safety',
    desc: 'Severe weather alerts affecting your home',
  },
  equipment_lifecycle: {
    label: 'Equipment Lifecycle',
    desc: 'Equipment aging and replacement reminders',
  },
  pro_services: {
    label: 'Pro Services',
    desc: 'Visit scheduling, quotes, and invoices',
  },
  account_billing: {
    label: 'Account & Billing',
    desc: 'Subscription and payment updates',
  },
};

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
];

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'settings'>('feed');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch independently so one failure doesn't block the other
        const [notifsResult, prefsResult] = await Promise.allSettled([
          supabaseService.getNotifications(user.id),
          supabaseService.getNotificationPreferences(user.id),
        ]);
        if (notifsResult.status === 'fulfilled') {
          setNotifications(notifsResult.value);
        } else {
          console.warn('Failed to load notifications:', notifsResult.reason);
          // Don't show error — just show empty feed
        }
        if (prefsResult.status === 'fulfilled' && prefsResult.value) {
          setPrefs(prefsResult.value);
        }
      } catch (err) {
        console.error('Failed to load notification data:', err);
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
      await supabaseService.updateNotificationPreferences(user.id, prefs as unknown as Record<string, unknown>);
      setSaved(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save preferences. Please try again.');
    }
  };

  const updateCategoryChannels = (category: string, channel: keyof CategoryChannelPrefs, value: boolean) => {
    setPrefs(prev => {
      const key = category as keyof NotificationPreferences;
      const catPrefs = prev[key] as CategoryChannelPrefs;
      if (!catPrefs || typeof catPrefs !== 'object' || !('push' in catPrefs)) return prev;
      return {
        ...prev,
        [key]: {
          ...catPrefs,
          [channel]: value,
        },
      };
    });
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
          <div className="card" style={{ backgroundColor: 'var(--color-error)20', borderLeft: `4px solid var(--color-error)`, marginBottom: 16 }}>
            <p style={{ color: 'var(--color-error)', fontSize: 14 }}>{error}</p>
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
                <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead} style={{ fontSize: 12, color: 'var(--color-sage)' }}>
                  Mark all as read
                </button>
              </div>
            )}

            {/* Notification Feed */}
            {notifications.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ marginBottom: 12 }}><BellIcon size={40} color={'var(--color-text-secondary)'} /></div>
                <h3 style={{ marginBottom: 6 }}>No Notifications Yet</h3>
                <p className="text-gray">Notifications about maintenance, weather, equipment, and billing will appear here.</p>
              </div>
            ) : (
              <div className="flex-col gap-sm">
                {notifications.map(n => {
                  const IconComponent = NOTIFICATION_ICON_MAP[n.category] || NOTIFICATION_ICON_MAP.general;
                  return (
                    <div
                      key={n.id}
                      className="card"
                      onClick={() => !n.read && handleMarkRead(n.id)}
                      style={{
                        padding: '14px 16px',
                        cursor: n.read ? 'default' : 'pointer',
                        opacity: n.read ? 0.7 : 1,
                        borderLeft: n.read ? 'none' : `3px solid var(--color-sage)`,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, display: 'flex' }}><IconComponent size={20} color={'var(--color-copper)'} /></span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <p style={{ fontWeight: n.read ? 500 : 600, fontSize: 14, color: 'var(--color-charcoal)' }}>{n.title}</p>
                            <span className="text-xs text-gray">{timeAgo(n.created_at)}</span>
                          </div>
                          {n.body && <p className="text-sm text-gray" style={{ margin: 0 }}>{n.body}</p>}
                        </div>
                        {!n.read && (
                          <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'var(--color-sage)', flexShrink: 0, marginTop: 6 }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'settings' && (
          <>
            {/* Section 1: Notification Categories */}
            <div className="card mb-lg">
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: 'var(--color-charcoal)' }}>Notification Categories</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>Choose how you receive each type of notification</p>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
                    <th style={{ textAlign: 'left', paddingBottom: 12, fontWeight: 600, fontSize: 12, color: 'var(--color-text-secondary)' }}>Category</th>
                    <th style={{ textAlign: 'center', paddingBottom: 12, fontWeight: 600, fontSize: 12, color: 'var(--color-text-secondary)' }}>Push</th>
                    <th style={{ textAlign: 'center', paddingBottom: 12, fontWeight: 600, fontSize: 12, color: 'var(--color-text-secondary)' }}>Email</th>
                    <th style={{ textAlign: 'center', paddingBottom: 12, fontWeight: 600, fontSize: 12, color: 'var(--color-text-secondary)' }}>SMS</th>
                    <th style={{ textAlign: 'center', paddingBottom: 12, fontWeight: 600, fontSize: 12, color: 'var(--color-text-secondary)' }}>In-App</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const categories: Array<{ key: keyof NotificationPreferences; locked?: boolean; lockReason?: string }> = [
                      { key: 'home_maintenance' },
                      { key: 'weather_safety' },
                      { key: 'equipment_lifecycle' },
                      { key: 'pro_services' },
                      { key: 'account_billing' },
                    ];

                    return categories.map((cat, idx) => {
                      const categoryPrefs = prefs[cat.key as keyof NotificationPreferences] as CategoryChannelPrefs;
                      return (
                        <tr key={cat.key} style={{ borderBottom: idx < categories.length - 1 ? `1px solid var(--color-border)` : 'none', opacity: cat.locked ? 0.5 : 1 }}>
                          <td style={{ paddingTop: 14, paddingBottom: 14 }}>
                            <div>
                              <p style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-charcoal)', margin: '0 0 4px 0' }}>{CATEGORY_INFO[cat.key].label}</p>
                              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                                {cat.locked ? cat.lockReason : CATEGORY_INFO[cat.key].desc}
                              </p>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', paddingTop: 14, paddingBottom: 14 }}>
                            <input
                              type="checkbox"
                              checked={categoryPrefs?.push || false}
                              onChange={(e) => !cat.locked && updateCategoryChannels(cat.key, 'push', e.target.checked)}
                              disabled={cat.locked}
                              style={{ width: 18, height: 18, cursor: cat.locked ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', paddingTop: 14, paddingBottom: 14 }}>
                            <input
                              type="checkbox"
                              checked={categoryPrefs?.email || false}
                              onChange={(e) => !cat.locked && updateCategoryChannels(cat.key, 'email', e.target.checked)}
                              disabled={cat.locked}
                              style={{ width: 18, height: 18, cursor: cat.locked ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', paddingTop: 14, paddingBottom: 14 }}>
                            <input
                              type="checkbox"
                              checked={categoryPrefs?.sms || false}
                              onChange={(e) => !cat.locked && updateCategoryChannels(cat.key, 'sms', e.target.checked)}
                              disabled={cat.locked || !prefs.phone}
                              title={!prefs.phone ? 'Add a phone number below to enable SMS' : ''}
                              style={{ width: 18, height: 18, cursor: (cat.locked || !prefs.phone) ? 'not-allowed' : 'pointer', opacity: prefs.phone ? 1 : 0.4 }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', paddingTop: 14, paddingBottom: 14 }}>
                            <input
                              type="checkbox"
                              checked={categoryPrefs?.in_app || false}
                              onChange={(e) => !cat.locked && updateCategoryChannels(cat.key, 'in_app', e.target.checked)}
                              disabled={cat.locked}
                              style={{ width: 18, height: 18, cursor: cat.locked ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Section 2: Phone & Timezone */}
            <div className="card mb-lg">
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: 'var(--color-charcoal)' }}>Phone & Timezone</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>Add your phone number to receive SMS alerts for critical notifications</p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-charcoal)' }}>Phone number</label>
                <input
                  type="tel"
                  placeholder="(555) 555-1234"
                  value={prefs.phone || ''}
                  onChange={(e) => setPrefs(prev => ({ ...prev, phone: e.target.value || undefined }))}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 6,
                    border: `1.5px solid var(--color-border)`, fontSize: 14,
                    background: 'var(--color-cream)', boxSizing: 'border-box',
                  }}
                />
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6, margin: '6px 0 0 0' }}>
                  SMS is used for critical alerts only (weather, pro visits, security). Standard message rates apply.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-charcoal)' }}>Timezone</label>
                <select
                  value={prefs.timezone || 'America/Chicago'}
                  onChange={(e) => setPrefs(prev => ({ ...prev, timezone: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 6,
                    border: `1.5px solid var(--color-border)`, fontSize: 14,
                    background: 'var(--color-cream)', boxSizing: 'border-box', cursor: 'pointer',
                  }}
                >
                  {US_TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6, margin: '6px 0 0 0' }}>
                  Used for quiet hours and delivery timing
                </p>
              </div>
            </div>

            {/* Section 3: Delivery & Timing */}
            <div className="card mb-lg">
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: 'var(--color-charcoal)' }}>Delivery & Timing</p>

              {/* How often */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontWeight: 500, fontSize: 13, marginBottom: 12, color: 'var(--color-charcoal)' }}>How often</p>
                <div className="flex-col gap-sm">
                  {[
                    { value: 'instant' as DigestFrequency, label: 'Instant' },
                    { value: 'daily_summary' as DigestFrequency, label: 'Daily Summary' },
                    { value: 'weekly_summary' as DigestFrequency, label: 'Weekly Summary' },
                  ].map(option => (
                    <label key={option.value} style={{
                      padding: '12px 16px', borderRadius: 4,
                      border: `1.5px solid ${prefs.digest_frequency === option.value ? 'var(--color-copper)' : 'var(--color-border)'}`,
                      background: prefs.digest_frequency === option.value ? 'var(--color-copper-muted, #FFF3E0)' : 'var(--color-cream)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <input
                        type="radio"
                        name="digestFrequency"
                        value={option.value}
                        checked={prefs.digest_frequency === option.value}
                        onChange={(e) => setPrefs(prev => ({ ...prev, digest_frequency: e.target.value as DigestFrequency }))}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ color: 'var(--color-charcoal)', fontWeight: 500 }}>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Reminder lead time */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontWeight: 500, fontSize: 13, marginBottom: 12, color: 'var(--color-charcoal)' }}>Reminder lead time</p>
                <div className="flex-col gap-sm">
                  {[
                    { value: 'day_of', label: 'Day of' },
                    { value: '1_day_before', label: '1 day before' },
                    { value: '3_days_before', label: '3 days before' },
                    { value: '1_week_before', label: '1 week before' },
                  ].map(option => (
                    <label key={option.value} style={{
                      padding: '12px 16px', borderRadius: 4,
                      border: `1.5px solid ${prefs.reminder_lead_time === option.value ? 'var(--color-copper)' : 'var(--color-border)'}`,
                      background: prefs.reminder_lead_time === option.value ? 'var(--color-copper-muted, #FFF3E0)' : 'var(--color-cream)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <input
                        type="radio"
                        name="reminderLeadTime"
                        value={option.value}
                        checked={prefs.reminder_lead_time === option.value}
                        onChange={(e) => setPrefs(prev => ({ ...prev, reminder_lead_time: e.target.value as typeof prev.reminder_lead_time }))}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ color: 'var(--color-charcoal)', fontWeight: 500 }}>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preferred time */}
              <div>
                <p style={{ fontWeight: 500, fontSize: 13, marginBottom: 12, color: 'var(--color-charcoal)' }}>Preferred time</p>
                <div className="flex-col gap-sm">
                  {[
                    { value: 'morning', label: 'Morning (8 AM)' },
                    { value: 'afternoon', label: 'Afternoon (2 PM)' },
                    { value: 'evening', label: 'Evening (6 PM)' },
                  ].map(option => (
                    <label key={option.value} style={{
                      padding: '12px 16px', borderRadius: 4,
                      border: `1.5px solid ${prefs.preferred_time === option.value ? 'var(--color-copper)' : 'var(--color-border)'}`,
                      background: prefs.preferred_time === option.value ? 'var(--color-copper-muted, #FFF3E0)' : 'var(--color-cream)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <input
                        type="radio"
                        name="preferredTime"
                        value={option.value}
                        checked={prefs.preferred_time === option.value}
                        onChange={(e) => setPrefs(prev => ({ ...prev, preferred_time: e.target.value as typeof prev.preferred_time }))}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ color: 'var(--color-charcoal)', fontWeight: 500 }}>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 3: Quiet Hours */}
            <div className="card mb-lg">
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: 'var(--color-charcoal)' }}>Quiet Hours</p>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={prefs.quiet_hours_enabled || false}
                    onChange={(e) => setPrefs(prev => ({ ...prev, quiet_hours_enabled: e.target.checked }))}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 500, color: 'var(--color-charcoal)' }}>Enable quiet hours</span>
                </label>
              </div>

              {prefs.quiet_hours_enabled && (
                <div style={{ marginTop: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>Start time</label>
                      <input
                        type="time"
                        value={prefs.quiet_hours_start || '22:00'}
                        onChange={(e) => setPrefs(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 4,
                          border: `1px solid var(--color-border)`, fontSize: 14, fontFamily: 'monospace',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>End time</label>
                      <input
                        type="time"
                        value={prefs.quiet_hours_end || '07:00'}
                        onChange={(e) => setPrefs(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 4,
                          border: `1px solid var(--color-border)`, fontSize: 14, fontFamily: 'monospace',
                        }}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 12, margin: '12px 0 0 0' }}>
                    Push and SMS notifications are silenced during quiet hours (based on your timezone). Emails and in-app are unaffected.
                  </p>
                </div>
              )}
            </div>

            {/* Section 4: Weekly Summary */}
            <div className="card mb-lg">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prefs.weekly_summary || false}
                  onChange={(e) => setPrefs(prev => ({ ...prev, weekly_summary: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
                />
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-charcoal)', margin: '0 0 4px 0' }}>Weekly Home Health Summary</p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Get a weekly email recap of your home's maintenance status</p>
                </div>
              </label>
            </div>

            {/* Save Button */}
            <div>
              <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', marginBottom: 12 }}>
                Save Preferences
              </button>
              {saved && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}><span style={{ display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }}><CheckCircleIcon size={14} color={'var(--color-success)'} /></span> Preferences saved</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
