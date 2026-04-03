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
}

export default function AdminProviderApplications() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ProviderApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'withdrawn'>('all');
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
      // Create pro_provider record
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
          application_id: app.id,
          user_id: null,
          is_available: true,
          created_at: new Date().toISOString(),
        });

      if (insertErr) throw insertErr;

      // Update application status
      const { error: updateErr } = await supabase
        .from('provider_applications')
        .update({ status: 'approved', review_notes: null })
        .eq('id', app.id);

      if (updateErr) throw updateErr;

      // Send welcome email via support-email edge function
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
        // Non-blocking error — provider still approved
      }

      // Log admin action
      logAdminAction('provider_application.approve', 'provider_application', app.id, {
        business_name: app.business_name,
        provider_id: providerId,
      }).catch(() => {});

      // Update local state
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

      // Log admin action
      logAdminAction('provider_application.reject', 'provider_application', app.id, {
        business_name: app.business_name,
        reason: notes,
      }).catch(() => {});

      // Update local state
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

      // Log admin action
      logAdminAction('provider_application.withdraw', 'provider_application', app.id, {
        business_name: app.business_name,
      }).catch(() => {});

      // Update local state
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

  const filtered = applications.filter(app => {
    // Status filter
    const statusMatch = statusFilter === 'all' || app.status === statusFilter;

    // Search filter: match business name, contact name, or email
    let searchMatch = true;
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      searchMatch =
        app.business_name?.toLowerCase().includes(searchLower) ||
        app.contact_name?.toLowerCase().includes(searchLower) ||
        app.email?.toLowerCase().includes(searchLower);
    }

    return statusMatch && searchMatch;
  });

  const tabCounts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    withdrawn: applications.filter(a => a.status === 'withdrawn').length,
  };

  return (
    <div className="page-wide">
      <div className="mb-lg">
        <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>
          &larr; Back
        </button>
        <h1>Provider Applications</h1>
        <p className="subtitle">{applications.length} total applications</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex gap-md mb-lg" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>
            Search
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Business name, contact, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="tabs mb-lg">
        {['all', 'pending', 'approved', 'rejected', 'withdrawn'].map(f => (
          <button
            key={f}
            className={`tab ${statusFilter === f ? 'active' : ''}`}
            onClick={() => setStatusFilter(f as any)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({tabCounts[f as keyof typeof tabCounts]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner" />
        </div>
      ) : (
        <div className="flex-col gap-md">
          {filtered.map(app => (
            <div key={app.id} className="card">
              <div
                style={{
                  cursor: 'pointer',
                  padding: 16,
                  borderRadius: 8,
                  background: expandedId === app.id ? Colors.cream : 'transparent',
                }}
                onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
              >
                {/* Header Row */}
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: expandedId === app.id ? 12 : 0 }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 4px 0' }}>
                      {app.business_name}
                    </p>
                    <p className="text-xs text-gray" style={{ margin: '0 0 2px 0' }}>
                      {app.contact_name} • {app.email}
                    </p>
                    <p className="text-xs text-gray" style={{ margin: 0 }}>
                      Applied: {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      className="badge"
                      style={{
                        background: getStatusColor(app.status) + '20',
                        color: getStatusColor(app.status),
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {app.status}
                    </span>
                    <span style={{ color: Colors.medGray, fontSize: 18 }}>
                      {expandedId === app.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === app.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${Colors.lightGray}` }}>
                    {/* Contact & License Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
                          Phone
                        </p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{app.phone || '—'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
                          License
                        </p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                          {app.license_number || '—'} ({app.license_state || '—'})
                        </p>
                      </div>
                    </div>

                    {/* Insurance Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
                          Insurance Carrier
                        </p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                          {app.insurance_carrier || '—'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
                          Policy Number
                        </p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                          {app.insurance_policy_number || '—'}
                        </p>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
                        Insurance Expires
                      </p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                        {app.insurance_expires_at
                          ? new Date(app.insurance_expires_at).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>

                    {/* Service Categories */}
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
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
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
                        Service Area ZIPs
                      </p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: Colors.charcoal }}>
                        {app.service_area_zips?.length > 0 ? app.service_area_zips.join(', ') : '—'}
                      </p>
                    </div>

                    {/* Bio */}
                    {app.bio && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
                          Bio
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: Colors.charcoal, lineHeight: 1.5 }}>
                          {app.bio}
                        </p>
                      </div>
                    )}

                    {/* Existing Review Notes (if any) */}
                    {app.review_notes && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0' }}>
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
                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${Colors.lightGray}` }}>
                        <div style={{ marginBottom: 12 }}>
                          <label
                            className="text-xs text-gray"
                            style={{ display: 'block', marginBottom: 4 }}
                          >
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

          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: Colors.copper }}>
                --
              </div>
              <h3>No applications</h3>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
