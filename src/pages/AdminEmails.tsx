import { useState, useEffect, useRef } from 'react';
import { PageSkeleton } from '@/components/Skeleton';
import { Colors } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import {
  getEmailTemplates,
  seedEmailTemplates,
  updateEmailTemplate,
  sendTestEmail,
  type EmailTemplate,
} from '@/services/emailTemplates';
import {
  previewBroadcastAudience,
  sendAdminBroadcast,
  type BroadcastSegment,
  type BroadcastPreview,
} from '@/services/admin';
import { logAdminAction } from '@/services/auditLog';
import { getErrorMessage } from '@/utils/errors';
import logger from '@/utils/logger';

export default function AdminEmails() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testEmailOpen, setTestEmailOpen] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [updateMap, setUpdateMap] = useState<Record<string, Partial<EmailTemplate>>>({});
  const [activeTab, setActiveTab] = useState<
    'admin' | 'user_transactional' | 'user_automated' | 'broadcast'
  >('admin');

  // --- Broadcast composer state ---
  const [bcTiers, setBcTiers] = useState<Array<'free' | 'home' | 'pro' | 'pro_plus'>>([]);
  const [bcRoles, setBcRoles] = useState<Array<'user' | 'agent' | 'admin' | 'pro_provider'>>([]);
  const [bcStates, setBcStates] = useState<string>(''); // comma-separated 2-letter codes
  const [bcHasAgent, setBcHasAgent] = useState<'any' | 'yes' | 'no'>('any');
  const [bcSmsVerifiedOnly, setBcSmsVerifiedOnly] = useState(false);
  const [bcSignedUpAfter, setBcSignedUpAfter] = useState('');
  const [bcSignedUpBefore, setBcSignedUpBefore] = useState('');
  const [bcLastActiveAfter, setBcLastActiveAfter] = useState('');
  const [bcChannel, setBcChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [bcTitle, setBcTitle] = useState('');
  const [bcBody, setBcBody] = useState('');
  const [bcActionUrl, setBcActionUrl] = useState('');
  const [bcPreview, setBcPreview] = useState<BroadcastPreview | null>(null);
  const [bcLoadingPreview, setBcLoadingPreview] = useState(false);
  const [bcSending, setBcSending] = useState(false);
  const [bcTestUserIdsText, setBcTestUserIdsText] = useState(''); // newline-separated ids for a safe test blast

  const buildSegment = (): BroadcastSegment => ({
    tiers: bcTiers.length ? bcTiers : undefined,
    roles: bcRoles.length ? bcRoles : undefined,
    states: bcStates.trim()
      ? bcStates.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : undefined,
    hasAgent: bcHasAgent === 'yes' ? true : bcHasAgent === 'no' ? false : undefined,
    // SMS channel implicitly requires verified phone; otherwise honor the checkbox.
    smsVerifiedOnly: bcChannel !== 'email' ? true : bcSmsVerifiedOnly || undefined,
    signedUpAfter: bcSignedUpAfter || null,
    signedUpBefore: bcSignedUpBefore || null,
    lastActiveAfter: bcLastActiveAfter || null,
    testUserIds: bcTestUserIdsText.trim()
      ? bcTestUserIdsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : undefined,
  });

  const runPreview = async () => {
    try {
      setBcLoadingPreview(true);
      const p = await previewBroadcastAudience(buildSegment());
      setBcPreview(p);
    } catch (err) {
      showToast({ message: `Preview failed: ${getErrorMessage(err)}` });
    } finally {
      setBcLoadingPreview(false);
    }
  };

  const runBroadcast = async (testMode: boolean) => {
    if (!bcTitle.trim() || !bcBody.trim()) {
      showToast({ message: 'Title and body are required' });
      return;
    }
    if (!testMode) {
      const ok = window.confirm(
        `Send "${bcTitle}" to ${bcPreview?.total ?? '?'} users via ${bcChannel.toUpperCase()}? This cannot be undone.`,
      );
      if (!ok) return;
    }
    try {
      setBcSending(true);
      const seg = buildSegment();
      const result = await sendAdminBroadcast(seg, {
        title: bcTitle.trim(),
        body: bcBody.trim(),
        action_url: bcActionUrl.trim() || undefined,
        channel: bcChannel,
        testMode,
      });
      await logAdminAction('admin_broadcast_send', 'notification', 'broadcast', {
        segment: seg,
        channel: bcChannel,
        title: bcTitle,
        sent: result.sent,
        skipped: result.skipped,
        testMode,
      });
      showToast({
        message: `Queued ${result.sent} notification${result.sent === 1 ? '' : 's'}${result.skipped ? ` (${result.skipped} unreachable skipped)` : ''}`,
      });
      if (result.errors.length) setError(result.errors.join('; '));
      if (!testMode) {
        setBcTitle('');
        setBcBody('');
        setBcActionUrl('');
      }
    } catch (err) {
      showToast({ message: `Broadcast failed: ${getErrorMessage(err)}` });
    } finally {
      setBcSending(false);
    }
  };

  const toggleTier = (t: 'free' | 'home' | 'pro' | 'pro_plus') =>
    setBcTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const toggleRole = (r: 'user' | 'agent' | 'admin' | 'pro_provider') =>
    setBcRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  // Body editor state
  const [bodyEditorOpen, setBodyEditorOpen] = useState<string | null>(null);
  const [bodyHtml, setBodyHtml] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [bodySaving, setBodySaving] = useState(false);
  const previewTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      let data = await getEmailTemplates();

      // If empty, seed and reload
      if (data.length === 0) {
        await seedEmailTemplates();
        data = await getEmailTemplates();
      }

      setTemplates(data);
    } catch (err) {
      setError(`Failed to load templates: ${getErrorMessage(err)}`);
      logger.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (template: EmailTemplate) => {
    const newEnabled = !template.enabled;
    try {
      await updateEmailTemplate(template.id, { enabled: newEnabled });
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, enabled: newEnabled } : t))
      );
    } catch (err) {
      setError(`Failed to update template: ${getErrorMessage(err)}`);
    }
  };

  const handleSubjectChange = (templateId: string, newSubject: string) => {
    setUpdateMap((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], subject: newSubject },
    }));
  };

  const handleSubjectBlur = async (template: EmailTemplate) => {
    const newSubject = updateMap[template.id]?.subject;
    if (!newSubject || newSubject === template.subject) {
      setUpdateMap((prev) => {
        const copy = { ...prev };
        delete copy[template.id];
        return copy;
      });
      return;
    }

    try {
      await updateEmailTemplate(template.id, { subject: newSubject });
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, subject: newSubject } : t))
      );
      setUpdateMap((prev) => {
        const copy = { ...prev };
        delete copy[template.id];
        return copy;
      });
    } catch (err) {
      setError(`Failed to update subject: ${getErrorMessage(err)}`);
    }
  };

  const handleSendTest = async (templateKey: string) => {
    if (!testEmail.trim()) {
      showToast({ message: 'Please enter a recipient email address' });
      return;
    }

    try {
      setTestSending(true);
      await sendTestEmail(templateKey, testEmail);
      showToast({ message: `Test email sent to ${testEmail}` });
      setTestEmailOpen(null);
      setTestEmail('');
    } catch (err) {
      showToast({ message: `Failed to send test email: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTestSending(false);
    }
  };

  const openBodyEditor = (template: EmailTemplate) => {
    setBodyEditorOpen(template.id);
    setBodyHtml(template.body_html || '');
    setPreviewHtml(template.body_html || '');
  };

  const closeBodyEditor = () => {
    setBodyEditorOpen(null);
    setBodyHtml('');
    setPreviewHtml('');
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
  };

  const handleBodyHtmlChange = (newHtml: string) => {
    setBodyHtml(newHtml);

    // Debounce preview update
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    previewTimeoutRef.current = window.setTimeout(() => {
      setPreviewHtml(newHtml);
    }, 500);
  };

  const handleInsertVariable = (variable: string, template: EmailTemplate | undefined) => {
    if (!template) return;

    const textarea = document.getElementById(`body-editor-${template.id}`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newHtml = bodyHtml.substring(0, start) + `{{${variable}}}` + bodyHtml.substring(end);
    handleBodyHtmlChange(newHtml);

    // Restore cursor position
    setTimeout(() => {
      textarea.selectionStart = start + variable.length + 4;
      textarea.selectionEnd = textarea.selectionStart;
      textarea.focus();
    }, 0);
  };

  const handleSaveBody = async (template: EmailTemplate) => {
    try {
      setBodySaving(true);
      await updateEmailTemplate(template.id, { body_html: bodyHtml || null });
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, body_html: bodyHtml || null } : t))
      );
      showToast({ message: 'Email body saved successfully' });
      closeBodyEditor();
    } catch (err) {
      showToast({ message: `Failed to save body: ${getErrorMessage(err)}` });
    } finally {
      setBodySaving(false);
    }
  };

  const handleClearBody = async (template: EmailTemplate) => {
    try {
      setBodySaving(true);
      await updateEmailTemplate(template.id, { body_html: null });
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, body_html: null } : t))
      );
      showToast({ message: 'Email body reset to system default' });
      closeBodyEditor();
    } catch (err) {
      showToast({ message: `Failed to reset body: ${getErrorMessage(err)}` });
    } finally {
      setBodySaving(false);
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'admin':
        return Colors.copper;
      case 'user_transactional':
        return Colors.sage;
      case 'user_automated':
        return Colors.info;
      case 'broadcast':
        return Colors.warning;
      default:
        return Colors.medGray;
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'admin':
        return 'Admin';
      case 'user_transactional':
        return 'User Transactional';
      case 'user_automated':
        return 'User Automated';
      case 'broadcast':
        return 'Broadcast';
      default:
        return category;
    }
  };

  const tabs: Array<'admin' | 'user_transactional' | 'user_automated' | 'broadcast'> = [
    'admin',
    'user_transactional',
    'user_automated',
    'broadcast',
  ];

  const filteredTemplates = templates.filter((t) => t.category === activeTab);
  const selectedTemplate = templates.find(t => t.id === bodyEditorOpen);

  return (
    <div className="page-wide">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1>Email Templates</h1>
          <p className="subtitle">Manage notification templates and test email delivery</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: Colors.error + '15',
            borderLeft: `4px solid ${Colors.error}`,
            marginBottom: 24,
            padding: 16,
            borderRadius: 4,
          }}
        >
          <p style={{ color: Colors.error, fontWeight: 600, margin: 0 }}>Error: {error}</p>
        </div>
      )}

      {loading ? (
        <div className="page-wide"><PageSkeleton rows={4} /></div>
      ) : (
        <>
          {/* Tabs */}
          <div className="admin-tabs" style={{ marginBottom: 32 }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  color: activeTab === tab ? getCategoryColor(tab) : Colors.medGray,
                  borderBottom: activeTab === tab ? `2px solid ${getCategoryColor(tab)}` : '1px solid ' + Colors.lightGray,
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {getCategoryLabel(tab)}
                {tab !== 'broadcast' && (
                  <span
                    style={{
                      marginLeft: 8,
                      opacity: 0.6,
                      fontSize: 12,
                    }}
                  >
                    ({templates.filter((t) => t.category === tab).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Broadcast Composer */}
          {activeTab === 'broadcast' && (
            <div style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
              <div
                style={{
                  background: Colors.warning + '15',
                  border: `1px dashed ${Colors.warning}`,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 13,
                  color: Colors.charcoal,
                }}
              >
                <strong>Send an ad-hoc broadcast</strong> to a filtered slice of users. All sends
                are audited. SMS only fires for users with a verified phone. Preview the audience
                before sending.
              </div>

              {/* Segment filters */}
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ margin: 0, marginBottom: 12 }}>Audience</h3>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <div>
                    <label style={bcLabelStyle}>Subscription tier</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(['free', 'home', 'pro', 'pro_plus'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTier(t)}
                          style={bcPillStyle(bcTiers.includes(t))}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Role</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(['user', 'agent', 'pro_provider', 'admin'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => toggleRole(r)}
                          style={bcPillStyle(bcRoles.includes(r))}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={bcLabelStyle}>States (comma-separated, 2-letter)</label>
                    <input
                      type="text"
                      value={bcStates}
                      onChange={(e) => setBcStates(e.target.value)}
                      placeholder="OK, TX, MO"
                      style={bcInputStyle}
                    />
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Has linked agent?</label>
                    <select
                      value={bcHasAgent}
                      onChange={(e) => setBcHasAgent(e.target.value as 'any' | 'yes' | 'no')}
                      style={bcInputStyle}
                    >
                      <option value="any">Any</option>
                      <option value="yes">Yes — linked to an agent</option>
                      <option value="no">No — unlinked</option>
                    </select>
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Signed up after</label>
                    <input
                      type="date"
                      value={bcSignedUpAfter}
                      onChange={(e) => setBcSignedUpAfter(e.target.value)}
                      style={bcInputStyle}
                    />
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Signed up before</label>
                    <input
                      type="date"
                      value={bcSignedUpBefore}
                      onChange={(e) => setBcSignedUpBefore(e.target.value)}
                      style={bcInputStyle}
                    />
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Active since</label>
                    <input
                      type="date"
                      value={bcLastActiveAfter}
                      onChange={(e) => setBcLastActiveAfter(e.target.value)}
                      style={bcInputStyle}
                    />
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Options</label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={bcSmsVerifiedOnly}
                        onChange={(e) => setBcSmsVerifiedOnly(e.target.checked)}
                      />
                      SMS-verified only
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={runPreview}
                    disabled={bcLoadingPreview}
                  >
                    {bcLoadingPreview ? 'Loading…' : 'Preview audience'}
                  </button>
                  {bcPreview && (
                    <span style={{ fontSize: 13, color: Colors.medGray, alignSelf: 'center' }}>
                      <strong style={{ color: Colors.charcoal }}>{bcPreview.total.toLocaleString()}</strong> match ·{' '}
                      {bcPreview.emailReachable.toLocaleString()} email · {bcPreview.smsReachable.toLocaleString()} SMS-eligible
                    </span>
                  )}
                </div>

                {bcPreview?.sample?.length ? (
                  <div style={{ marginTop: 12, border: `1px solid ${Colors.lightGray}`, borderRadius: 6, padding: 10 }}>
                    <div style={{ fontSize: 11, color: Colors.medGray, marginBottom: 6 }}>Sample (first 10)</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                      {bcPreview.sample.map((s) => (
                        <li key={s.id}>
                          {s.full_name || s.email || s.id} {s.email && <span style={{ color: Colors.medGray }}>· {s.email}</span>}
                          {s.sms_verified && <span style={{ color: Colors.sage, marginLeft: 6 }}>📱</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {/* Message composer */}
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ margin: 0, marginBottom: 12 }}>Message</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={bcLabelStyle}>Channel</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['email', 'sms', 'both'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setBcChannel(c)}
                          style={bcPillStyle(bcChannel === c)}
                        >
                          {c.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 6 }}>
                      SMS fires via Twilio; recipients must be SMS-verified. Push delivery happens
                      automatically for any user with a registered push token.
                    </p>
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Title / SMS preview</label>
                    <input
                      type="text"
                      value={bcTitle}
                      onChange={(e) => setBcTitle(e.target.value)}
                      placeholder="e.g., Planned maintenance tonight"
                      maxLength={140}
                      style={bcInputStyle}
                    />
                    <div style={{ fontSize: 11, color: Colors.medGray, marginTop: 4 }}>
                      {bcTitle.length}/140 · shown first on both email and SMS
                    </div>
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Body</label>
                    <textarea
                      value={bcBody}
                      onChange={(e) => setBcBody(e.target.value)}
                      placeholder="Full message body. For SMS, first 140 characters of title+body are sent."
                      rows={5}
                      style={{ ...bcInputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Action URL (optional)</label>
                    <input
                      type="url"
                      value={bcActionUrl}
                      onChange={(e) => setBcActionUrl(e.target.value)}
                      placeholder="https://canopyhome.app/dashboard"
                      style={bcInputStyle}
                    />
                  </div>
                  <div>
                    <label style={bcLabelStyle}>Test recipients (override segment)</label>
                    <textarea
                      value={bcTestUserIdsText}
                      onChange={(e) => setBcTestUserIdsText(e.target.value)}
                      placeholder="user-uuid-1 user-uuid-2 (space or newline separated)"
                      rows={2}
                      style={{ ...bcInputStyle, fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 4 }}>
                      Send yourself a test before blasting. When populated, test-send targets these
                      ids only and ignores the segment filter above.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => runBroadcast(true)}
                    disabled={bcSending || !bcTestUserIdsText.trim()}
                    title={!bcTestUserIdsText.trim() ? 'Add at least one test user id' : 'Send to test ids only'}
                  >
                    {bcSending ? 'Sending…' : 'Send test'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => runBroadcast(false)}
                    disabled={bcSending || !bcTitle.trim() || !bcBody.trim()}
                  >
                    {bcSending ? 'Sending…' : `Send broadcast${bcPreview ? ` (${bcPreview.total})` : ''}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Card Grid */}
          {activeTab !== 'broadcast' && (
          <div className="admin-card-grid">
            {filteredTemplates.length === 0 ? (
              <div className="admin-empty">
                <p>No templates in this category</p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="admin-card"
                  style={{
                    border: `1px solid ${Colors.lightGray}`,
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Header with Toggle */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600 }}>
                        {template.name}
                      </h3>
                      <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>
                        {template.description}
                      </p>
                    </div>

                    {/* Toggle Switch */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={template.enabled}
                        onChange={() => handleToggleEnabled(template)}
                        style={{
                          width: 18,
                          height: 18,
                          cursor: 'pointer',
                          accentColor: getCategoryColor(template.category),
                        }}
                      />
                      <span style={{ fontSize: 12, color: Colors.medGray }}>
                        {template.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  {/* Subject Line Edit */}
                  <div style={{ borderTop: `1px solid ${Colors.lightGray}`, paddingTop: 12 }}>
                    <label style={{ fontSize: 12, color: Colors.medGray, fontWeight: 500 }}>
                      Subject
                    </label>
                    <input
                      type="text"
                      value={
                        updateMap[template.id]?.subject !== undefined
                          ? updateMap[template.id].subject!
                          : template.subject
                      }
                      onChange={(e) => handleSubjectChange(template.id, e.target.value)}
                      onBlur={() => handleSubjectBlur(template)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: `1px solid ${Colors.lightGray}`,
                        borderRadius: 4,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        marginTop: 6,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Variables Pills */}
                  {template.variables.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {template.variables.map((variable) => (
                        <span
                          key={variable}
                          style={{
                            backgroundColor: Colors.lightGray,
                            color: Colors.medGray,
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 500,
                            fontFamily: 'monospace',
                          }}
                        >
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openBodyEditor(template)}
                      style={{ width: '100%' }}
                    >
                      {template.body_html ? 'Edit Body' : 'Add Custom Body'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setTestEmailOpen(template.template_key)}
                      style={{ width: '100%' }}
                    >
                      Send Test Email
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          )}
        </>
      )}

      {/* Test Email Modal */}
      {testEmailOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setTestEmailOpen(null);
            setTestEmail('');
          }}
        >
          <div
            style={{
              background: 'var(--color-card-background)',
              borderRadius: 8,
              padding: 24,
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 600 }}>
              Send Test Email
            </h3>
            <p style={{ color: Colors.medGray, fontSize: 14, margin: '0 0 16px 0' }}>
              Enter an email address to receive a test of this template.
            </p>
            <input
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={() => handleSendTest(testEmailOpen)}
                disabled={testSending}
                style={{ flex: 1 }}
              >
                {testSending ? 'Sending...' : 'Send'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setTestEmailOpen(null);
                  setTestEmail('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body Editor Modal */}
      {bodyEditorOpen && selectedTemplate && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={closeBodyEditor}
        >
          <div
            style={{
              background: 'var(--color-card-background)',
              borderRadius: 8,
              width: '100%',
              maxWidth: 1200,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: 20,
                borderBottom: `1px solid ${Colors.lightGray}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600 }}>
                  Edit Email Body
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>
                  {selectedTemplate.name}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={closeBodyEditor}
                style={{ fontSize: 20, padding: '4px 8px' }}
              >
                ×
              </button>
            </div>

            {/* Content Area */}
            <div
              style={{
                display: 'flex',
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              {/* Left Panel - Editor */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: `1px solid ${Colors.lightGray}`,
                  overflow: 'hidden',
                }}
              >
                {/* Variable Reference */}
                {selectedTemplate.variables.length > 0 && (
                  <div style={{ padding: 16, borderBottom: `1px solid ${Colors.lightGray}` }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 500, color: Colors.medGray }}>
                      Available variables (click to insert):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedTemplate.variables.map((variable) => (
                        <button
                          key={variable}
                          onClick={() => handleInsertVariable(variable, selectedTemplate)}
                          style={{
                            backgroundColor: getCategoryColor(selectedTemplate.category),
                            color: Colors.white,
                            padding: '6px 12px',
                            borderRadius: 16,
                            fontSize: 11,
                            fontWeight: 500,
                            fontFamily: 'monospace',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                          {`{{${variable}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Textarea */}
                <textarea
                  id={`body-editor-${selectedTemplate.id}`}
                  value={bodyHtml}
                  onChange={(e) => handleBodyHtmlChange(e.target.value)}
                  placeholder="No custom template — using system default. Paste HTML here to override."
                  style={{
                    flex: 1,
                    padding: 16,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                    border: 'none',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Right Panel - Preview */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderBottom: `1px solid ${Colors.lightGray}`,
                    backgroundColor: Colors.warmWhite,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: Colors.medGray }}>
                    Live Preview
                  </p>
                </div>
                <div style={{ flex: 1, overflow: 'auto', backgroundColor: Colors.white }}>
                  {previewHtml ? (
                    <iframe
                      srcDoc={previewHtml}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        backgroundColor: Colors.white,
                      }}
                      title="Email Body Preview"
                    />
                  ) : (
                    <div
                      style={{
                        padding: 24,
                        color: Colors.medGray,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                      }}
                    >
                      <p>No custom body configured. Using system defaults.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer / Actions */}
            <div
              style={{
                padding: 16,
                borderTop: `1px solid ${Colors.lightGray}`,
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                backgroundColor: Colors.warmWhite,
              }}
            >
              <button
                className="btn btn-ghost btn-sm"
                onClick={closeBodyEditor}
                disabled={bodySaving}
              >
                Cancel
              </button>
              {bodyHtml && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleClearBody(selectedTemplate)}
                  disabled={bodySaving}
                >
                  Reset to Default
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setTestEmailOpen(selectedTemplate.template_key)}
                disabled={bodySaving}
              >
                Send Test
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleSaveBody(selectedTemplate)}
                disabled={bodySaving}
              >
                {bodySaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Broadcast composer styles ---
const bcLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: Colors.medGray,
  textTransform: 'uppercase',
  marginBottom: 6,
  letterSpacing: 0.5,
};

const bcInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${Colors.lightGray}`,
  borderRadius: 4,
  fontSize: 13,
  boxSizing: 'border-box',
  background: 'var(--color-card-background)',
  color: Colors.charcoal,
};

const bcPillStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 16,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  border: `1px solid ${active ? Colors.sage : Colors.lightGray}`,
  background: active ? Colors.sage : 'transparent',
  color: active ? Colors.white : Colors.charcoal,
  transition: 'all 0.15s ease',
});
