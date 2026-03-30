import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import {
  getEmailTemplates,
  seedEmailTemplates,
  updateEmailTemplate,
  sendTestEmail,
  type EmailTemplate,
} from '@/services/emailTemplates';

export default function AdminEmails() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testEmailOpen, setTestEmailOpen] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [updateMap, setUpdateMap] = useState<Record<string, Partial<EmailTemplate>>>({});

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
      setError(`Failed to load templates: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (template: EmailTemplate) => {
    const newEnabled = !template.enabled;
    try {
      await updateEmailTemplate(template.id, { enabled: newEnabled });
      setTemplates(prev =>
        prev.map(t => (t.id === template.id ? { ...t, enabled: newEnabled } : t))
      );
    } catch (err) {
      setError(`Failed to update template: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSubjectChange = (templateId: string, newSubject: string) => {
    setUpdateMap(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], subject: newSubject },
    }));
  };

  const handleSubjectBlur = async (template: EmailTemplate) => {
    const newSubject = updateMap[template.id]?.subject;
    if (!newSubject || newSubject === template.subject) {
      setUpdateMap(prev => {
        const copy = { ...prev };
        delete copy[template.id];
        return copy;
      });
      return;
    }

    try {
      await updateEmailTemplate(template.id, { subject: newSubject });
      setTemplates(prev =>
        prev.map(t => (t.id === template.id ? { ...t, subject: newSubject } : t))
      );
      setUpdateMap(prev => {
        const copy = { ...prev };
        delete copy[template.id];
        return copy;
      });
    } catch (err) {
      setError(`Failed to update subject: ${err instanceof Error ? err.message : String(err)}`);
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
        return 'Admin Notifications';
      case 'user_transactional':
        return 'User Transactional';
      case 'user_automated':
        return 'User Automated';
      default:
        return category;
    }
  };

  const groupedTemplates = templates.reduce(
    (acc, template) => {
      const cat = template.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(template);
      return acc;
    },
    {} as Record<string, EmailTemplate[]>
  );

  const categories: Array<'admin' | 'user_transactional' | 'user_automated'> = [
    'admin',
    'user_transactional',
    'user_automated',
  ];

  return (
    <div className="page-wide">
      <div className="mb-lg">
        <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>
          &larr; Back
        </button>
        <h1>Email Templates</h1>
        <p className="subtitle" style={{ color: Colors.medGray }}>
          Manage notification templates and test email delivery
        </p>
      </div>

      {error && (
        <div
          className="card"
          style={{
            background: Colors.error + '15',
            borderLeft: `4px solid ${Colors.error}`,
            marginBottom: 24,
            padding: 16,
          }}
        >
          <p style={{ color: Colors.error, fontWeight: 600, margin: 0 }}>Error: {error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center" style={{ paddingTop: 100 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <p className="mt-md text-gray">Loading email templates...</p>
        </div>
      ) : (
        <>
          {categories.map(category => (
            <div key={category} style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: `2px solid ${getCategoryColor(category)}20`,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: getCategoryColor(category),
                  }}
                />
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                  {getCategoryLabel(category)}
                </h2>
                <span className="badge" style={{ background: getCategoryColor(category) + '20', color: getCategoryColor(category) }}>
                  {groupedTemplates[category]?.length || 0}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {(groupedTemplates[category] || []).map(template => (
                  <div
                    key={template.id}
                    className="card"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr auto auto',
                      alignItems: 'center',
                      gap: 16,
                      padding: 16,
                    }}
                  >
                    {/* Toggle */}
                    <input
                      type="checkbox"
                      checked={template.enabled}
                      onChange={() => handleToggleEnabled(template)}
                      style={{
                        width: 20,
                        height: 20,
                        cursor: 'pointer',
                        accentColor: getCategoryColor(category),
                      }}
                    />

                    {/* Name + Description */}
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: Colors.charcoal }}>
                        {template.name}
                      </div>
                      <div style={{ fontSize: 13, color: Colors.medGray, marginBottom: 8 }}>
                        {template.description}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: Colors.silver, marginRight: 12 }}>
                          Subject:
                        </span>
                        <input
                          type="text"
                          value={
                            updateMap[template.id]?.subject !== undefined
                              ? updateMap[template.id].subject!
                              : template.subject
                          }
                          onChange={e => handleSubjectChange(template.id, e.target.value)}
                          onBlur={() => handleSubjectBlur(template)}
                          style={{
                            padding: '6px 8px',
                            border: `1px solid ${Colors.lightGray}`,
                            borderRadius: 4,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            width: '100%',
                            maxWidth: 500,
                          }}
                        />
                      </div>
                    </div>

                    {/* Send Test Button */}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setTestEmailOpen(template.template_key)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Send Test
                    </button>

                    {/* Status Indicator */}
                    <div
                      style={{
                        textAlign: 'center',
                        fontSize: 12,
                        color: template.enabled ? Colors.success : Colors.silver,
                        fontWeight: 600,
                      }}
                    >
                      {template.enabled ? '✓' : '○'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
            background: 'rgba(0, 0, 0, 0.3)',
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
            className="card"
            style={{ width: '100%', maxWidth: 400, padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Send Test Email</h3>
            <p style={{ color: Colors.medGray, fontSize: 14 }}>
              Enter an email address to receive a test of this template.
            </p>
            <input
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
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
