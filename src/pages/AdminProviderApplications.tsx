import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { Colors } from '@/constants/theme';

interface ProviderApplication {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  license_number: string;
  license_state: string;
  insurance_carrier: string;
  insurance_policy_number: string;
  insurance_expires_at: string;
  service_categories: string[];
  service_area_zips: string[];
  bio: string;
  agreed_to_terms: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  review_notes: string | null;
  created_at: string;
  requested_type: 'canopy_technician' | 'partner_pro';
}

export default function AdminProviderApplications() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ProviderApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'withdrawn'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (e: any) {
      console.error('Error loading applications:', e);
      alert('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (app: ProviderApplication) => {
    if (!confirm(`Approve ${app.business_name}? This will create a pro provider record and send a welcome email.`)) {
      return;
    }

    setActionInProgress(app.id);
    try {
      const providerId = crypto.randomUUID();
      const { error: insertErr } = await supabase
        .from('pro_providers')
        .insert({
          id: providerId,
          business_name: app.business_name,
          contact_name: app.contact_name,
          email: app.email,
          phone: app.phone,
          license_number: app.license_number,
          license_state: app.license_state,
          insurance_carrier: app.insurance_carrier,
          insurance_policy_number: app.insurance_policy_number,
          insurance_expires_at: app.insurance_expires_at,
          service_categories: app.service_categories,
          service_area_zips: app.service_area_zips,
          bio: app.bio,
          provider_status: 'approved',
          provider_type: app.requested_type || 'partner_pro',
          application_id: app.id,
          user_id: null,
          is_available: true,
          created_at: new Date().toISOString(),
        });

      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from('provider_applications')
        .update({ status: 'approved', review_notes: null })
        .eq('id', app.id);

      if (updateErr) throw updateErr;

      try {
        await supabase.functions.invoke('support-email', {
          body: {
            mode: 'provider-welcome',
            email: app.email,
            contact_name: app.contact_name,
            business_name: app.business_name,
          },
        });
      } catch (emailErr) {
        console.error('Welcome email error:', emailErr);
      }

      logAdminAction('provider_application.approve', 'provider_application', app.id, {
        business_name: app.business_name,
        provider_id: providerId,
      }).catch(() => {});

      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, status: 'approved' } : a)
      );
    } catch (e: any) {
      console.error('Approval error:', e);
      alert(e.message || 'Failed to approve application');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (app: ProviderApplication) => {
    const notes = rejectNotes[app.id] || '';
    if (!notes.trim()) {
      alert('Please provide review notes for rejection');
      return;
    }

    if (!confirm(`Reject ${app.business_name}? This will update the application status.`)) {
      return;
    }

    setActionInProgress(app.id);
    try {
      const { error } = await supabase
        .from('provider_applications')
        .update({ status: 'rejected', review_notes: notes })
        .eq('id', app.id);

      if (error) throw error;

      logAdminAction('provider_application.reject', 'provider_application', app.id, {
        business_name: app.business_name,
        reason: notes,
      }).catch(() => {});

      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, status: 'rejected', review_notes: notes } : a)
      );

      setRejectNotes(prev => {
        const updated = { ...prev };
        delete updated[app.id];
        return updated;
      });
    } catch (e: any) {
      console.error('Rejection error:', e);
      alert(e.message || 'Failed to reject application');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleWithdraw = async (app: ProviderApplication) => {
    if (!confirm(`Withdraw ${app.business_name}? This is a destructive action.`)) {
      return;
    }

    setActionInProgress(app.id);
    try {
      const { error } = await supabase
        .from('provider_applications')
        .update({ status: 'withdrawn', review_notes: 'Withdrawn by admin' })
        .eq('id', app.id);

      if (error) throw error;

      logAdminAction('provider_application.withdraw', 'provider_application', app.id, {
        business_name: app.business_name,
      }).catch(() => {});

      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, status: 'withdrawn' } : a)
      );
    } catch (e: any) {
      console.error('Withdrawal error:', e);
      alert(e.message || 'Failed to withdraw application');
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'approved':
        return Colors.success;
      case 'rejected':
        return Colors.error;
      case 'withdrawn':
        return Colors.medGray;
      default:
        return Colors.medGray;
    }
  };

  const filtered = applications.filter(app => activeTab === 'all' || app.status === activeTab);

  const tabCounts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    withdrawn: applications.filter(a => a.status === 'withdrawn').length,
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1>Provider Applications</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: Colors.medGray }}>
            Review and manage provider applications.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 24 }}>
        {(['all', 'pending', 'approved', 'rejected', 'withdrawn'] as const).map(tab => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('_', ' ')} ({tabCounts[tab]})
          </button>
        ))}
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="admin-empty" style={{ textAlign: 'center', padding: 40 }}>
          <p>Loading applications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty" style={{ textAlign: 'center', padding: 40 }}>
          <p>No applications found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(app => (
            <div key={app.id} className="admin-card-grid" style={{ cursor: 'pointer' }}>
              <div
                onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                style={{ padding: 16 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>
                        {app.business_name}
                      </p>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase',
                        background: app.requested_type === 'canopy_technician' ? '#e6f5ee' : '#fdf3e6',
                        color: app.requested_type === 'canopy_technician' ? '#1a6b4a' : '#6b4a1a',
                      }}>
                        {app.requested_type === 'canopy_technician' ? 'Technician' : 'Partner Pro'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 2px 0' }}>
                      {app.contact_name} • {app.email}
                    </p>
                    <p style={{ fontSize: 12, color: Colors.silver, margin: 0 }}>
                      Applied {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
                    <span
                      className="admin-status"
                      style={{
                        background: getStatusColor(app.status) + '20',
                        color: getStatusColor(app.status),
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {app.status}
                    </span>
                    <span style={{ color: Colors.medGray, fontSize: 16 }}>
                      {expandedId === app.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === app.id && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid var(--border-color)` }}>
                    {/* Contact & License Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          Phone
                        </p>
                        <p style={{ margin: 0, fontSize: 13 }}>{app.phone || '—'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          License
                        </p>
                        <p style={{ margin: 0, fontSize: 13 }}>
                          {app.license_number || '—'} ({app.license_state || '—'})
                        </p>
                      </div>
                    </div>

                    {/* Insurance Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          Insurance Carrier
                        </p>
                        <p style={{ margin: 0, fontSize: 13 }}>
                          {app.insurance_carrier || '—'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          Policy Number
                        </p>
                        <p style={{ margin: 0, fontSize: 13 }}>
                          {app.insurance_policy_number || '—'}
                        </p>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                        Insurance Expires
                      </p>
                      <p style={{ margin: 0, fontSize: 13 }}>
                        {app.insurance_expires_at
                          ? new Date(app.insurance_expires_at).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>

                    {/* Service Categories */}
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                        Service Categories
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {app.service_categories?.length > 0 ? (
                          app.service_categories.map(cat => (
                            <span
                              key={cat}
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: Colors.sageMuted,
                                color: Colors.sage,
                                fontWeight: 600,
                              }}
                            >
                              {cat}
                            </span>
                          ))
                        ) : (
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>—</p>
                        )}
                      </div>
                    </div>

                    {/* Service Area ZIPs */}
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                        Service Area ZIPs
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: Colors.charcoal }}>
                        {app.service_area_zips?.length > 0 ? app.service_area_zips.join(', ') : '—'}
                      </p>
                    </div>

                    {/* Bio */}
                    {app.bio && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          Bio
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: Colors.charcoal, lineHeight: 1.5 }}>
                          {app.bio}
                        </p>
                      </div>
                    )}

                    {/* Existing Review Notes */}
                    {app.review_notes && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          Review Notes
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: Colors.charcoal,
                            padding: '8px 12px',
                            background: Colors.lightGray,
                            borderRadius: 4,
                            lineHeight: 1.5,
                          }}
                        >
                          {app.review_notes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    {app.status === 'pending' && (
                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid var(--border-color)` }}>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', fontSize: 11, color: Colors.medGray, marginBottom: 4, fontWeight: 600 }}>
                            Rejection Notes (if rejecting)
                          </label>
                          <textarea
                            className="form-input"
                            placeholder="Explain why this application is being rejected..."
                            rows={3}
                            value={rejectNotes[app.id] || ''}
                            onChange={e => setRejectNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                            style={{ width: '100%', padding: '8px', fontSize: 13 }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleApprove(app)}
                            disabled={actionInProgress === app.id}
                            style={{ flex: 1, minWidth: 100 }}
                          >
                            {actionInProgress === app.id ? '...' : '✓ Approve'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: Colors.error, flex: 1, minWidth: 100 }}
                            onClick={() => handleReject(app)}
                            disabled={actionInProgress === app.id}
                          >
                            {actionInProgress === app.id ? '...' : '✕ Reject'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: Colors.medGray, flex: 1, minWidth: 100 }}
                            onClick={() => handleWithdraw(app)}
                            disabled={actionInProgress === app.id}
                          >
                            {actionInProgress === app.id ? '...' : 'Withdraw'}
                          </button>
                        </div>
                      </div>
                    )}

                    {app.status === 'rejected' && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: '12px',
                          background: Colors.error + '10',
                          borderRadius: 6,
                          borderLeft: `3px solid ${Colors.error}`,
                        }}
                      >
                        <p style={{ fontSize: 11, color: Colors.error, fontWeight: 600, margin: '0 0 4px 0' }}>
                          REJECTED
                        </p>
                        {app.review_notes && (
                          <p style={{ fontSize: 12, color: Colors.charcoal, margin: 0 }}>
                            {app.review_notes}
                          </p>
                        )}
                      </div>
                    )}

                    {app.status === 'approved' && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: '12px',
                          background: Colors.success + '10',
                          borderRadius: 6,
                          borderLeft: `3px solid ${Colors.success}`,
                        }}
                      >
                        <p style={{ fontSize: 11, color: Colors.success, fontWeight: 600, margin: 0 }}>
                          ✓ APPROVED & INVITED
                        </p>
                      </div>
                    )}

                    {app.status === 'withdrawn' && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: '12px',
                          background: Colors.medGray + '15',
                          borderRadius: 6,
                          borderLeft: `3px solid ${Colors.medGray}`,
                        }}
                      >
                        <p style={{ fontSize: 11, color: Colors.medGray, fontWeight: 600, margin: 0 }}>
                          WITHDRAWN
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
