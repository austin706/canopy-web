import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { logAdminAction } from '@/services/auditLog';
import type { SubscriptionTier } from '@/types';

interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  action_url?: string;
  read: boolean;
  created_at: string;
  user?: { full_name: string; email: string };
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  subscription_tier: SubscriptionTier;
}

const NOTIFICATION_CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'home_maintenance', label: 'Home Maintenance' },
  { id: 'pro_invoice', label: 'Pro Invoice' },
  { id: 'weather_alert', label: 'Weather Alert' },
  { id: 'system', label: 'System' },
];

export default function AdminNotifications() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  // Form state
  const [audience, setAudience] = useState<'single' | 'all' | 'tier'>('single');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [actionUrl, setActionUrl] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, subscription_tier')
        .order('full_name');
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch recent notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('id, user_id, title, category, read, created_at, body, action_url')
        .order('created_at', { ascending: false })
        .limit(50);
      if (notificationsError) throw notificationsError;

      // Enrich notifications with user info
      const enriched = await Promise.all(
        (notificationsData || []).map(async (n) => {
          const user = usersData?.find((u) => u.id === n.user_id);
          return {
            ...n,
            user: user ? { full_name: user.full_name, email: user.email } : undefined,
          };
        })
      );
      setNotifications(enriched);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setMessage({ type: 'error', text: 'Title and body are required' });
      return;
    }

    if (audience === 'single' && !selectedUserId) {
      setMessage({ type: 'error', text: 'Please select a user' });
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      let userIds: string[] = [];

      if (audience === 'single') {
        userIds = [selectedUserId];
      } else if (audience === 'all') {
        userIds = users.map((u) => u.id);
      } else if (audience === 'tier') {
        userIds = users.filter((u) => u.subscription_tier === selectedTier).map((u) => u.id);
      }

      if (userIds.length === 0) {
        setMessage({ type: 'error', text: 'No users found for selected criteria' });
        setSending(false);
        return;
      }

      // Send via edge function so push + email fire alongside in-app
      // Use raw fetch instead of supabase.functions.invoke to avoid SDK payload issues
      const session = (await supabase.auth.getSession()).data.session;
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notifications`;

      let payload: Record<string, any> = { title, body, category, action_url: actionUrl || undefined };
      if (audience === 'single') {
        payload.user_id = userIds[0];
      } else if (audience === 'all') {
        payload.broadcast_all = true;
      } else if (audience === 'tier') {
        payload.broadcast_tier = selectedTier;
      }

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Edge function returned ${res.status}`);
      }

      // Log audit action
      await logAdminAction('notification.broadcast', 'notification', 'broadcast', {
        audience,
        recipient_count: userIds.length,
        category,
        title,
      });

      setMessage({
        type: 'success',
        text: `Notification sent to ${userIds.length} user${userIds.length !== 1 ? 's' : ''}`,
      });

      // Reset form
      setTitle('');
      setBody('');
      setActionUrl('');
      setCategory('general');
      setSelectedUserId('');

      // Refresh notifications list
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to send notification' });
    } finally {
      setSending(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="page-wide">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1>Notifications</h1>
          <p className="subtitle">{unreadCount} unread</p>
        </div>
        <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
          {sending ? 'Sending...' : 'Send Notification'}
        </button>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          style={{
            background: message.type === 'success' ? Colors.success + '15' : Colors.error + '15',
            borderLeft: `4px solid ${message.type === 'success' ? Colors.success : Colors.error}`,
            marginBottom: 24,
            padding: 16,
            borderRadius: 4,
          }}
        >
          <p
            style={{
              color: message.type === 'success' ? Colors.success : Colors.error,
              margin: 0,
              fontWeight: 500,
            }}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Main Layout: Compose Form (Left) + Recent Notifications (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Compose Form - Left Side */}
        <div className="admin-section">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, marginTop: 0 }}>
            Compose Notification
          </h2>

          {/* Audience Selection */}
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: 12, display: 'block' }}>
              Target Audience
            </label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {(['single', 'all', 'tier'] as const).map((opt) => (
                <label
                  key={opt}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  <input
                    type="radio"
                    value={opt}
                    checked={audience === opt}
                    onChange={(e) => setAudience(e.target.value as 'single' | 'all' | 'tier')}
                  />
                  <span>
                    {opt === 'single' ? 'Single User' : opt === 'all' ? 'All Users' : 'By Tier'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* User Picker */}
          {audience === 'single' && (
            <div className="form-group">
              <label>Select User</label>
              <select
                className="form-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">— Choose a user —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tier Picker */}
          {audience === 'tier' && (
            <div className="form-group">
              <label>Select Tier</label>
              <select
                className="form-select"
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value as SubscriptionTier)}
              >
                <option value="free">Free</option>
                <option value="home">Home</option>
                <option value="pro">Pro</option>
                <option value="pro_plus">Pro+</option>
              </select>
            </div>
          )}

          {/* Category - Pills/Chips Style */}
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: 12, display: 'block' }}>
              Category
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {NOTIFICATION_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{
                    padding: '8px 14px',
                    border: `2px solid ${category === cat.id ? Colors.copper : Colors.lightGray}`,
                    background: category === cat.id ? Colors.copper + '10' : 'transparent',
                    color: category === cat.id ? Colors.copper : Colors.charcoal,
                    borderRadius: 20,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label style={{ fontWeight: 500 }}>Title</label>
            <input
              className="form-input"
              type="text"
              placeholder="Notification title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="form-group">
            <label style={{ fontWeight: 500 }}>Body</label>
            <textarea
              className="form-input"
              placeholder="Notification message"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Action URL */}
          <div className="form-group">
            <label style={{ fontWeight: 500 }}>Action URL (optional)</label>
            <input
              className="form-input"
              type="text"
              placeholder="/tasks or /subscription"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={sending}
              style={{ flex: 1 }}
            >
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setTitle('');
                setBody('');
                setActionUrl('');
                setCategory('general');
                setSelectedUserId('');
              }}
              disabled={sending}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Recent Notifications - Right Side */}
        <div className="admin-section">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 }}>
            Recent Notifications
          </h2>
          <div className="admin-table-wrapper">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div className="spinner" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="admin-empty">
                <p>No notifications sent yet</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Target</th>
                    <th>Category</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: Colors.medGray, marginTop: 2 }}>
                          {n.body.substring(0, 50)}
                          {n.body.length > 50 ? '...' : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: Colors.medGray }}>
                          {n.user?.full_name || 'System'}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              n.category === 'system'
                                ? Colors.error + '20'
                                : Colors.copper + '20',
                            color:
                              n.category === 'system'
                                ? Colors.error
                                : Colors.copper,
                            fontSize: 11,
                          }}
                        >
                          {n.category}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: Colors.medGray }}>
                        {new Date(n.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
