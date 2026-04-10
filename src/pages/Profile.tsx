import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase, updateProfile, redeemGiftCode, deleteUserAccount, exportUserData, lookupAgentByCode, linkAgent, getCalendarToken, rotateCalendarToken, buildICalSubscribeUrl } from '@/services/supabase';
import { PLANS } from '@/services/subscriptionGate';
import MessageBanner from '@/components/MessageBanner';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeMode } from '@/constants/theme';
import type { SubscriptionTier, UserPreferences, MaintenanceDepth } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';

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

  // C12: Account deletion modal (typed-confirm pattern) + data export state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // iCal subscription
  const [calToken, setCalToken] = useState<string | null>(user?.calendar_token ?? null);
  const [calLoading, setCalLoading] = useState(false);
  const [calCopied, setCalCopied] = useState(false);

  // Maintenance Preferences
  const [editingPreferences, setEditingPreferences] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [maintenanceDepth, setMaintenanceDepth] = useState<MaintenanceDepth>(
    user?.user_preferences?.maintenance_depth || DEFAULT_USER_PREFERENCES.maintenance_depth
  );
  const [showCleaningTasks, setShowCleaningTasks] = useState(
    user?.user_preferences?.show_cleaning_tasks ?? DEFAULT_USER_PREFERENCES.show_cleaning_tasks
  );
  const [showProTasks, setShowProTasks] = useState(
    user?.user_preferences?.show_pro_tasks ?? DEFAULT_USER_PREFERENCES.show_pro_tasks
  );

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

  const handleSavePreferences = async () => {
    if (!user) return;
    setPreferencesLoading(true);
    try {
      const updatedPreferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        ...(user.user_preferences || {}),
        maintenance_depth: maintenanceDepth,
        show_cleaning_tasks: showCleaningTasks,
        show_pro_tasks: showProTasks,
      };
      await updateProfile(user.id, { user_preferences: updatedPreferences });
      setUser({ ...user, user_preferences: updatedPreferences });
      setEditingPreferences(false);
      setMessage('Preferences updated');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      setMessage(e.message || 'Failed to update preferences');
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleEnableCalendar = async () => {
    if (!user) return;
    setCalLoading(true);
    try {
      let token = await getCalendarToken(user.id);
      if (!token) token = await rotateCalendarToken(user.id);
      setCalToken(token);
      setUser({ ...user, calendar_token: token });
      setMessage('Calendar subscription ready');
    } catch (e: any) {
      setMessage(e.message || 'Failed to set up calendar');
    } finally { setCalLoading(false); setTimeout(() => setMessage(''), 3000); }
  };

  const handleRotateCalendar = async () => {
    if (!user) return;
    if (!confirm('Rotating will invalidate any calendar apps already subscribed with the old link. Continue?')) return;
    setCalLoading(true);
    try {
      const token = await rotateCalendarToken(user.id);
      setCalToken(token);
      setUser({ ...user, calendar_token: token });
      setMessage('New calendar link generated — update your calendar app');
    } catch (e: any) {
      setMessage(e.message || 'Failed to rotate token');
    } finally { setCalLoading(false); setTimeout(() => setMessage(''), 4000); }
  };

  const handleCopyCalendarUrl = async () => {
    if (!calToken) return;
    try {
      await navigator.clipboard.writeText(buildICalSubscribeUrl(calToken));
      setCalCopied(true);
      setTimeout(() => setCalCopied(false), 2500);
    } catch {
      setMessage('Copy failed — select the URL manually');
      setTimeout(() => setMessage(''), 3000);
    }
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
    try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    reset();
    window.location.href = '/login';
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== 'DELETE') {
      setMessage('Please type DELETE in all caps to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteUserAccount(user.id);
      try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
      reset();
      window.location.href = '/login';
    } catch (e: any) {
      setMessage('Failed to delete account: ' + e.message);
      setDeleting(false);
    }
  };

  // C12: GDPR/CCPA data export — calls the export_user_data RPC and triggers a
  // browser download of a canopy-data-export-{YYYY-MM-DD}.json file so the user
  // has a portable copy of everything Canopy stores about them.
  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const data = await exportUserData(user.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `canopy-data-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage('Your data has been exported. Check your downloads folder.');
      setTimeout(() => setMessage(''), 5000);
    } catch (e: any) {
      setMessage('Failed to export data: ' + (e?.message || 'unknown error'));
    } finally {
      setExporting(false);
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
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-copper)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: Colors.white, fontSize: 24, fontWeight: 700 }}>
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

      {/* Maintenance Preferences */}
      <div className="card mb-lg">
        <div className="flex items-center justify-between mb-lg">
          <h3 style={{ fontSize: 18 }}>Maintenance Preferences</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingPreferences(!editingPreferences)}>
            {editingPreferences ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {!editingPreferences && user?.user_preferences && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 4px 0' }}>Maintenance Depth</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: Colors.charcoal }}>
                {maintenanceDepth === 'simple' ? 'Just the Essentials' : maintenanceDepth === 'standard' ? 'Recommended' : 'Everything'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 4px 0' }}>Cleaning Tasks</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: Colors.charcoal }}>
                {showCleaningTasks ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 4px 0' }}>Pro Tasks</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: Colors.charcoal }}>
                {showProTasks ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        )}

        {editingPreferences && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal, marginBottom: 12 }}>Maintenance Depth</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {[
                { value: 'simple' as const, title: 'Just the Essentials', desc: 'Focus on the most important maintenance tasks. Perfect if you\'re just getting started.' },
                { value: 'standard' as const, title: 'Recommended', desc: 'A complete maintenance plan tailored to your home. Our recommendation for most homeowners.', recommended: true },
                { value: 'comprehensive' as const, title: 'Everything', desc: 'Every possible maintenance task, including detailed cleaning and specialty items.' },
              ].map(option => (
                <div
                  key={option.value}
                  onClick={() => setMaintenanceDepth(option.value)}
                  style={{
                    border: `2px solid ${maintenanceDepth === option.value ? Colors.copper : Colors.lightGray}`,
                    borderRadius: 12, padding: 16,
                    backgroundColor: maintenanceDepth === option.value ? Colors.copperMuted : Colors.white,
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {option.recommended && (
                    <span style={{
                      position: 'absolute', top: -12, right: 16,
                      background: Colors.copper, color: Colors.white,
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                    }}>
                      Recommended
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: maintenanceDepth === option.value ? Colors.copper : Colors.charcoal, marginBottom: 4 }}>
                        {option.title}
                      </div>
                      <p style={{ fontSize: 13, color: Colors.medGray, margin: 0, lineHeight: 1.4 }}>
                        {option.desc}
                      </p>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 10, border: `2px solid ${maintenanceDepth === option.value ? Colors.copper : Colors.lightGray}`,
                      background: maintenanceDepth === option.value ? Colors.copper : 'transparent',
                      marginLeft: 12, marginTop: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {maintenanceDepth === option.value && <span style={{ color: Colors.white, fontSize: 14, fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={showCleaningTasks} onChange={e => setShowCleaningTasks(e.target.checked)} />
                <span style={{ fontSize: 14 }}>Show cleaning tasks (deep clean, pressure washing, etc.)</span>
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={showProTasks} onChange={e => setShowProTasks(e.target.checked)} />
                <span style={{ fontSize: 14 }}>Show pro service recommendations</span>
              </label>
            </div>

            <button className="btn btn-primary" onClick={handleSavePreferences} disabled={preferencesLoading}>
              {preferencesLoading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        )}
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

      {/* Calendar Subscription (iCal feed) */}
      <div className="card mb-lg">
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Calendar Subscription</h3>
        <p className="text-xs text-gray mb-md">
          Subscribe your calendar app (Apple Calendar, Google Calendar, Outlook) to get maintenance tasks automatically with 24-hour reminders. Updates every 15 minutes.
        </p>
        {!calToken ? (
          <button className="btn btn-primary btn-sm" onClick={handleEnableCalendar} disabled={calLoading}>
            {calLoading ? 'Setting up…' : 'Enable Calendar Feed'}
          </button>
        ) : (
          <div className="flex-col gap-sm">
            <input
              className="form-input"
              readOnly
              value={buildICalSubscribeUrl(calToken)}
              onFocus={(e) => e.currentTarget.select()}
              style={{ fontSize: 12, fontFamily: 'monospace' }}
            />
            <div className="flex gap-sm">
              <button className="btn btn-primary btn-sm" onClick={handleCopyCalendarUrl} disabled={calLoading} style={{ flex: 1 }}>
                {calCopied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={`webcal://${buildICalSubscribeUrl(calToken).replace(/^https?:\/\//, '')}`}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
              >
                Add to Calendar
              </a>
              <button className="btn btn-secondary btn-sm" onClick={handleRotateCalendar} disabled={calLoading}>
                {calLoading ? 'Rotating…' : 'Rotate'}
              </button>
            </div>
            <p className="text-xs text-gray" style={{ marginTop: 4 }}>
              Paste this URL into your calendar app's "Subscribe to calendar" option, or click "Add to Calendar" for one-click setup. Rotating invalidates any calendar already subscribed with the old link.
            </p>
          </div>
        )}
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

      {/* C12: Data Export + Delete Account */}
      <div className="card mt-lg">
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Your Data</h3>
        <p className="text-sm text-gray mb-md">
          Download a complete copy of everything Canopy stores about you — profile, homes, equipment, maintenance logs, invoices, documents, and more — as a portable JSON file.
        </p>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExportData}
          disabled={exporting}
        >
          {exporting ? 'Preparing export…' : 'Export My Data'}
        </button>
      </div>

      <div className="card mt-lg" style={{ border: '1px solid var(--color-error)40' }}>
        <h3 style={{ fontSize: 16, marginBottom: 8, color: 'var(--color-error)' }}>Danger Zone</h3>
        <p className="text-sm text-gray mb-md">
          Permanently delete your account and all associated data — profile, homes, equipment, maintenance history, invoices, notifications, and support tickets. This action cannot be undone.
        </p>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
        >
          Delete My Account
        </button>
      </div>

      {/* C12: Account deletion confirmation modal (typed-confirm pattern) */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setShowDeleteModal(false); }}
        >
          <div
            className="card"
            style={{ maxWidth: 480, width: '100%', padding: 24 }}
          >
            <h3 id="delete-modal-title" style={{ fontSize: 18, marginBottom: 12, color: Colors.error }}>
              Delete your Canopy account?
            </h3>
            <p className="text-sm" style={{ marginBottom: 12, lineHeight: 1.6 }}>
              This will permanently delete everything associated with <strong>{user?.email}</strong>, including:
            </p>
            <ul className="text-sm text-gray" style={{ marginBottom: 16, paddingLeft: 20, lineHeight: 1.8 }}>
              <li>Your profile and all home records</li>
              <li>All equipment, maintenance logs, and tasks</li>
              <li>Invoices, payments, and service history</li>
              <li>Documents, notes, and notifications</li>
              <li>Your Canopy subscription (cancel separately in Stripe/App Store if active)</li>
            </ul>
            <p className="text-sm" style={{ marginBottom: 8, lineHeight: 1.5 }}>
              Consider exporting your data first — we won't be able to recover it afterward.
            </p>
            <p className="text-sm" style={{ marginBottom: 8 }}>
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              className="form-input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              disabled={deleting}
              style={{ width: '100%', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
              >
                {deleting ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
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
