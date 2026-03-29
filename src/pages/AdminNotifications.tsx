import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';
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

export default function AdminNotifications() {
  const navigate = useNavigate();
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
      <div className="flex items-center justify-between mb-lg">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>
            &larr; Back
          </button>
          <h1>Notifications</h1>
          <p className="subtitle">{unreadCount} unread</p>
        </div>
      </div>

      {message && (
        <div
          className="card"
          style={{
            background:
              message.type === 'success'
                ? Colors.success + '15'
                : Colors.error + '15',
            borderLeft: `4px solid ${message.type === 'success' ? Colors.success : Colors.error}`,
            marginBottom: 24,
            padding: 16,
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

      {/* Send Notification Form */}
      <div className="card mb-lg">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Send Notification</h2>

        {/* Audience Selection */}
        <div className="form-group">
          <label style={{ fontWeight: 600, marginBottom: 12, display: 'block' }}>Audience</label>
          <div style={{ display: 'flex', gap: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                value="single"
                checked={audience === 'single'}
                onChange={(e) => setAudience(e.target.value as 'single' | 'all' | 'tier')}
              />
              <span>Single User</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                value="all"
                checked={audience === 'all'}
                onChange={(e) => setAudience(e.target.value as 'single' | 'all' | 'tier')}
              />
              <span>All Users</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                value="tier"
                checked={audience === 'tier'}
                onChange={(e) => setAudience(e.target.value as 'single' | 'all' | 'tier')}
              />
              <span>By Tier</span>
            </label>
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

        {/* Category */}
        <div className="form-group">
          <label>Category</label>
          <select
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="general">General</option>
            <option value="home_maintenance">Home Maintenance</option>
            <option value="pro_invoice">Pro Invoice</option>
            <option value="weather_alert">Weather Alert</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* Title */}
        <div className="form-group">
          <label>Title</label>
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
          <label>Body</label>
          <textarea
            className="form-input"
            placeholder="Notification message"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Action URL */}
        <div className="form-group">
          <label>Action URL (optional)</label>
          <input
            className="form-input"
            type="text"
            placeholder="/tasks or /subscription"
            value={actionUrl}
            onChange={(e) => setActionUrl(e.target.value)}
          />
        </div>

        {/* Send Button */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending}
            style={{ minWidth: 120 }}
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

      {/* Recent Notifications Table */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recent Notifications</h2>
        <div className="card table-container">
          {loading ? (
            <div className="text-center" style={{ padding: 32 }}>
              <div className="spinner" />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Sent At</th>
                  <th>Read</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>
                          {n.user?.full_name || '—'}
                        </div>
                        <div style={{ fontSize: 12, color: Colors.medGray }}>
                          {n.user?.email || '—'}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{n.title}</td>
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
                    <td className="text-sm text-gray">
                      {new Date(n.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: n.read ? Colors.silver : Colors.copper,
                        }}
                        title={n.read ? 'Read' : 'Unread'}
                      />
                    </td>
                  </tr>
                ))}
                {notifications.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray" style={{ padding: 32 }}>
                      No notifications yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
