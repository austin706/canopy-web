import { useState, useEffect } from 'react';
import { Colors } from '@/constants/theme';
import {
  getEmailTemplates,
  seedEmailTemplates,
  updateEmailTemplate,
  sendTestEmail,
  type EmailTemplate,
} from '@/services/emailTemplates';
import { getErrorMessage } from '@/utils/errors';

export default function AdminEmails() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testEmailOpen, setTestEmailOpen] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [updateMap, setUpdateMap] = useState<Record<string, Partial<EmailTemplate>>>({});
  const [activeTab, setActiveTab] = useState<'admin' | 'user_transactional' | 'user_automated'>(
    'admin'
  );

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
      console.error('Error loading templates:', err);
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
      alert('Please enter a recipient email address');
      return;
    }

    try {
      setTestSending(true);
      await sendTestEmail(templateKey, testEmail);
      alert(`Test email sent to ${testEmail}`);
      setTestEmailOpen(null);
      setTestEmail('');
    } catch (err) {
      alert(`Failed to send test email: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestSending(false);
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
      default:
        return category;
    }
  };

  const tabs: Array<'admin' | 'user_transactional' | 'user_automated'> = [
    'admin',
    'user_transactional',
    'user_automated',
  ];

  const filteredTemplates = templates.filter((t) => t.category === activeTab);

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
        <div style={{ textAlign: 'center', paddingTop: 100 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <p className="mt-md text-gray">Loading email templates...</p>
        </div>
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
                <span
                  style={{
                    marginLeft: 8,
                    opacity: 0.6,
                    fontSize: 12,
                  }}
                >
                  ({templates.filter((t) => t.category === tab).length})
                </span>
              </button>
            ))}
          </div>

          {/* Card Grid */}
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

                  {/* Send Test Button */}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setTestEmailOpen(template.template_key)}
                    style={{ width: '100%' }}
                  >
                    Send Test Email
                  </button>
                </div>
              ))
            )}
          </div>
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
    </div>
  );
}
