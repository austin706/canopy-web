import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { signOut, updateProfile, redeemGiftCode, deleteUserAccount, lookupAgentByCode, linkAgent } from '@/services/supabase';
import { PLANS } from '@/services/subscriptionGate';
import MessageBanner from '@/components/MessageBanner';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeMode } from '@/constants/theme';
import type { SubscriptionTier } from '@/types';

export default function Profile() {
  const navigate = useNavigate();
  const { user, setUser, setAgent, reset } = useStore();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [linkingAgent, setLinkingAgent] = useState(false);

  const tier = user?.subscription_tier || 'free';
  const plan = PLANS.find(p => p.value === tier);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, { full_name: fullName, phone });
      setUser({ ...user, full_name: fullName, phone });
      setEditing(false);
      setMessage('Profile updated');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      setMessage(e.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleRedeem = async () => {
    if (!giftCode.trim() || !user) return;
    setRedeeming(true);
    try {
      const result = await redeemGiftCode(giftCode, user.id);
      setUser({ ...user, subscription_tier: result.tier as SubscriptionTier, subscription_expires_at: result.expiresAt, agent_id: result.agent?.id });
      if (result.agent) setAgent(result.agent);
      setMessage(`Upgraded to ${PLANS.find(p => p.value === result.tier)?.name}!`);
      setGiftCode('');
    } catch (e: any) {
      setMessage(e.message || 'Failed to redeem');
    } finally { setRedeeming(false); setTimeout(() => setMessage(''), 5000); }
  };

  const handleLinkAgent = async () => {
    if (!agentCode.trim() || !user) return;
    setLinkingAgent(true);
    try {
      const agent = await lookupAgentByCode(agentCode);
      await linkAgent(user.id, agent.id);
      setUser({ ...user, agent_id: agent.id });
      setAgent(agent);
      setMessage(`Linked to agent: ${agent.name}`);
      setAgentCode('');
    } catch (e: any) {
      setMessage(e.message || 'Failed to link agent');
    } finally { setLinkingAgent(false); setTimeout(() => setMessage(''), 5000); }
  };

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    reset();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete your account? This will permanently remove all your data including your home, equipment, and maintenance history.')) return;
    if (!confirm('This action cannot be undone. Are you absolutely sure?')) return;
    try {
      await deleteUserAccount(user.id);
      try { await signOut(); } catch {}
      reset();
      navigate('/login');
    } catch (e: any) {
      setMessage('Failed to delete account: ' + e.message);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <h1>Profile & Settings</h1>
      </div>

      {message && <MessageBanner message={message} />}

      {/* Profile Card */}
      <div className="card mb-lg">
        <div className="flex items-center gap-lg mb-lg">
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-copper)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700 }}>
            {user?.full_name?.charAt(0) || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20 }}>{user?.full_name}</h2>
            <p className="text-sm text-gray">{user?.email}</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button>
        </div>

        {editing && (
          <div>
            <div className="form-group"><label>Full Name</label><input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} /></div>
            <div className="form-group"><label>Phone</label><input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        )}
      </div>

      {/* Subscription */}
      <div className="card mb-lg" style={{ background: 'var(--color-copper-muted, #FFF3E0)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs fw-600 text-copper mb-sm">SUBSCRIPTION</p>
            <h3>{plan?.name || 'Free'}</h3>
            <p className="text-sm text-gray">{(plan as any)?.inquireForPricing ? 'Concierge Plan' : `$${plan?.price || 0}${plan?.period}`}</p>
            {user?.subscription_expires_at && <p className="text-xs text-gray mt-sm">Expires: {new Date(user.subscription_expires_at).toLocaleDateString()}</p>}
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/subscription')}>
            {tier === 'free' ? 'Upgrade' : 'Manage Plan'}
          </button>
        </div>
      </div>

      {/* Gift Code */}
      <div className="card mb-lg">
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Redeem Gift Code</h3>
        <div className="flex gap-sm">
          <input className="form-input" value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())} placeholder="Enter code" style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleRedeem} disabled={redeeming || !giftCode.trim()}>
            {redeeming ? 'Redeeming...' : 'Redeem'}
          </button>
        </div>
      </div>

      {/* Link Agent */}
      {!user?.agent_id && (
        <div className="card mb-lg">
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Link Your Agent</h3>
          <p className="text-xs text-gray mb-md">Enter your real estate agent's email or agent code to connect with them.</p>
          <div className="flex gap-sm">
            <input className="form-input" value={agentCode} onChange={e => setAgentCode(e.target.value)} placeholder="Agent email or code" style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={handleLinkAgent} disabled={linkingAgent || !agentCode.trim()}>
              {linkingAgent ? 'Linking...' : 'Link'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="card mb-lg">
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Settings & Details</h3>
        <div className="flex-col">
          <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', borderBottom: '1px solid var(--light-gray)' }} onClick={() => navigate('/home')}>
            Home Details
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', borderBottom: '1px solid var(--light-gray)' }} onClick={() => navigate('/notifications')}>
            Notifications
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', borderBottom: '1px solid var(--light-gray)' }} onClick={() => navigate('/subscription')}>
            Subscription & Billing
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', borderBottom: '1px solid var(--light-gray)' }} onClick={() => navigate('/agent')}>
            My Agent
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', borderBottom: '1px solid var(--light-gray)' }} onClick={() => navigate('/logs')}>
            Maintenance Logs
          </button>
          {user?.role === 'admin' && (
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', borderBottom: '1px solid var(--light-gray)' }} onClick={() => navigate('/admin')}>
              Admin Portal
            </button>
          )}
          {user?.role === 'agent' && (
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/agent-portal')}>
              Agent Portal
            </button>
          )}
        </div>
      </div>

      {/* Appearance / Dark Mode */}
      <ThemeToggle />

      <button className="btn btn-danger btn-full" onClick={handleLogout}>Sign Out</button>

      {/* Delete Account */}
      <div className="card mt-lg" style={{ border: '1px solid var(--color-error)40' }}>
        <h3 style={{ fontSize: 16, marginBottom: 8, color: 'var(--color-error)' }}>Danger Zone</h3>
        <p className="text-sm text-gray mb-md">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount}>Delete My Account</button>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { mode, setMode, colors } = useTheme();
  const options: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
  ];
  return (
    <div className="card mb-lg">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Appearance</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              border: `2px solid ${mode === opt.value ? 'var(--color-sage)' : 'var(--color-border)'}`,
              background: mode === opt.value ? 'var(--color-sage-muted, #f0f4f0)' : 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: mode === opt.value ? 600 : 400,
              color: 'var(--color-charcoal)',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ display: 'block', fontSize: 20, marginBottom: 4 }}>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
