import { useState, useEffect } from 'react';
import { getAllProRequests, updateProRequest, getAllProProviders, sendNotification, supabase } from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { StatusColors, Colors } from '@/constants/theme';

interface Provider {
  id: string;
  business_name: string;
  contact_name: string;
  service_categories: string[];
  zip_codes?: string[];
  is_available: boolean;
  max_jobs_per_day?: number;
  active_job_count?: number;
}

export default function AdminProRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'matched' | 'scheduled' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAllProRequests().then(async (reqs) => {
        const enriched = await Promise.all(reqs.map(async (r: any) => {
          if (r.home_id && !r.home) {
            try {
              const { data: home } = await supabase.from('homes').select('zip_code').eq('id', r.home_id).single();
              return { ...r, home };
            } catch { return r; }
          }
          return r;
        }));
        setRequests(enriched);
        return enriched;
      }).catch(() => []),
      getAllProProviders().then(async (provs: any[]) => {
        const enriched = await Promise.all(provs.map(async (p: any) => {
          try {
            const { count } = await supabase
              .from('pro_requests')
              .select('*', { count: 'exact', head: true })
              .eq('provider_id', p.id)
              .in('status', ['matched', 'scheduled']);
            return { ...p, active_job_count: count || 0 };
          } catch { return { ...p, active_job_count: 0 }; }
        }));
        setProviders(enriched);
        return enriched;
      }).catch(() => []),
    ]).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const request = requests.find(r => r.id === id);
      const oldStatus = request?.status;

      await updateProRequest(id, { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

      logAdminAction('request.status_change', 'pro_request', id, { old_status: oldStatus, new_status: status }).catch(() => {});

      if (request?.user_id && (status === 'scheduled' || status === 'completed')) {
        const messages: Record<string, { title: string; body: string }> = {
          scheduled: {
            title: 'Service Scheduled',
            body: `Your ${request.category || request.service_type} service has been scheduled. Your provider will reach out with the exact time.`,
          },
          completed: {
            title: 'Service Completed',
            body: `Your ${request.category || request.service_type} service has been marked as completed. Thank you for using Canopy Pro!`,
          },
        };
        const msg = messages[status];
        if (msg) {
          sendNotification({
            user_id: request.user_id,
            title: msg.title,
            body: msg.body,
            category: 'pro_service',
            action_url: '/pro-request',
          }).catch(() => {});
        }
      }
    } catch (e: any) { alert(e.message); }
  };

  const handleAssignProvider = async (requestId: string, providerId: string) => {
    if (!providerId) return;
    try {
      const assignedProvider = providers.find(p => p.id === providerId);
      const request = requests.find(r => r.id === requestId);
      const category = request?.category || request?.service_type;

      await updateProRequest(requestId, { assigned_provider: providerId, status: 'matched' });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, assigned_provider: providerId, status: 'matched' } : r));

      logAdminAction('request.assign', 'pro_request', requestId, { provider_name: assignedProvider?.business_name || assignedProvider?.contact_name, category }).catch(() => {});

      if (request) {
        const appointmentDate = request.preferred_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        await supabase
          .from('pro_service_appointments')
          .insert({
            home_id: request.home_id || null,
            title: `${(request.category || request.service_type || 'Service').replace(/^\w/, (c: string) => c.toUpperCase())} Request`,
            scheduled_date: appointmentDate,
            scheduled_time: '09:00',
            status: 'proposed',
            service_purpose: request.description,
            pro_provider_id: providerId,
            request_id: requestId,
            notes: 'Assigned by admin',
          })
          .then(({ error: apptErr }) => {
            if (apptErr) console.warn('Failed to create linked appointment:', apptErr);
          });
      }

      if (request?.user_id) {
        sendNotification({
          user_id: request.user_id,
          title: 'Pro Provider Assigned',
          body: `${assignedProvider?.business_name || assignedProvider?.contact_name || 'A pro provider'} has been assigned to your ${request.category || request.service_type} request. They will be in touch to schedule service.`,
          category: 'pro_service',
          action_url: '/pro-request',
        }).catch(() => {});
      }

      if (assignedProvider) {
        const { data: providerProfile } = await supabase
          .from('pro_providers').select('user_id').eq('id', providerId).single();
        if (providerProfile?.user_id) {
          sendNotification({
            user_id: providerProfile.user_id,
            title: 'New Service Assignment',
            body: `You've been assigned a ${request?.category || request?.service_type || 'service'} request from ${request?.user?.full_name || 'a homeowner'}.${request?.preferred_date ? ` Preferred date: ${new Date(request.preferred_date).toLocaleDateString()}.` : ''}`,
            category: 'pro_service',
            action_url: '/pro-portal',
          }).catch(() => {});
        }
      }
    } catch (e: any) { alert(e.message); }
  };

  const handleUnassignProvider = async (requestId: string) => {
    try {
      await updateProRequest(requestId, { assigned_provider: null, status: 'pending' });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, assigned_provider: null, status: 'pending' } : r));
    } catch (e: any) { alert(e.message); }
  };

  const getMatchingProviders = (category: string, homeZip?: string) => {
    const categoryMatches = providers.filter(p =>
      p.is_available && p.service_categories?.includes(category)
    );
    if (!homeZip) return categoryMatches;
    const zipMatches = categoryMatches.filter(p =>
      p.zip_codes?.includes(homeZip)
    );
    return zipMatches.length > 0 ? zipMatches : categoryMatches;
  };

  const getProviderName = (providerId: string) => {
    const p = providers.find(pr => pr.id === providerId);
    return p ? p.business_name || p.contact_name : 'Unknown Provider';
  };

  const filtered = requests.filter(r => {
    const statusMatch = statusFilter === 'all' || r.status === statusFilter;
    let searchMatch = true;
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      const homeownerEmail = r.user?.email?.toLowerCase() || '';
      const category = (r.category || r.service_type || '').toLowerCase();
      const providerName = r.assigned_provider ? (getProviderName(r.assigned_provider) || '').toLowerCase() : '';

      searchMatch = homeownerEmail.includes(searchLower) ||
                    category.includes(searchLower) ||
                    providerName.includes(searchLower);
    }
    return statusMatch && searchMatch;
  });

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    matched: requests.filter(r => r.status === 'matched').length,
    scheduled: requests.filter(r => r.status === 'scheduled').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  const getStatusBadgeColor = (status: string) => {
    return StatusColors[status] || Colors.medGray;
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 28, fontWeight: 700 }}>Pro Service Requests</h1>
          <p style={{ margin: 0, fontSize: 14, color: Colors.medGray }}>
            {requests.length} total requests • {counts.pending} pending • {counts.matched} matched • {counts.scheduled} scheduled • {counts.completed} completed
          </p>
        </div>
      </div>

      {/* Tabs for Status Filtering */}
      {!loading && (
        <div className="admin-tabs" style={{ marginBottom: 24 }}>
          {(['all', 'pending', 'matched', 'scheduled', 'completed'] as const).map(tab => (
            <button
              key={tab}
              className={`admin-tab ${statusFilter === tab ? 'admin-tab-active' : ''}`}
              onClick={() => { setStatusFilter(tab); setExpandedId(null); }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab]})
            </button>
          ))}
        </div>
      )}

      {/* Search and Filter Toolbar */}
      {!loading && (
        <div className="admin-table-toolbar" style={{ marginBottom: 24 }}>
          <input
            type="text"
            className="admin-search"
            placeholder="Search by email, category, or provider..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="text-center" style={{ padding: '40px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>Category</th>
                <th>ZIP</th>
                <th>Homeowner</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isExpanded = expandedId === r.id;
                const homeZip = r.home?.zip_code;
                const matching = getMatchingProviders(r.category || r.service_type, homeZip);
                const allProvidersList = providers.filter(p => p.is_available);
                const noZipCoverage = homeZip && matching.length === 0;

                return (
                  <tbody key={r.id}>
                    <tr style={{ cursor: 'pointer', background: isExpanded ? Colors.cream : 'transparent' }} onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                      <td style={{ textAlign: 'center', color: Colors.medGray }}>
                        {isExpanded ? '▼' : '▶'}
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 500 }}>{r.category || r.service_type}</td>
                      <td style={{ fontSize: 13, color: Colors.medGray }}>{homeZip || '—'}</td>
                      <td style={{ fontSize: 13 }}>{r.user?.email || '—'}</td>
                      <td>
                        <span className="admin-status" style={{
                          background: getStatusBadgeColor(r.status) + '20',
                          color: getStatusBadgeColor(r.status),
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: Colors.medGray }}>
                        {r.assigned_provider ? getProviderName(r.assigned_provider) : '—'}
                      </td>
                      <td style={{ fontSize: 13, color: Colors.medGray }}>
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: Colors.cream }}>
                        <td colSpan={7} style={{ padding: 20 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            {/* Left: Request Details */}
                            <div>
                              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Request Details</h4>
                              <div style={{ fontSize: 13, lineHeight: 1.6, color: Colors.charcoal }}>
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ color: Colors.medGray }}>Description:</span> {r.description || '—'}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ color: Colors.medGray }}>Homeowner:</span> {r.user?.full_name || r.user?.email || '—'}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ color: Colors.medGray }}>Submitted:</span> {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                {r.preferred_date && (
                                  <div style={{ marginBottom: 8 }}>
                                    <span style={{ color: Colors.medGray }}>Preferred Date:</span> {new Date(r.preferred_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </div>
                                )}
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ color: Colors.medGray }}>Status:</span>
                                  <select
                                    className="form-select"
                                    value={r.status}
                                    onChange={e => { handleStatusChange(r.id, e.target.value); e.stopPropagation(); }}
                                    style={{ width: '100%', marginTop: 4, padding: '4px 8px', fontSize: 12 }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="matched">Matched</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Right: Provider Assignment */}
                            <div>
                              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Provider Assignment</h4>
                              {r.assigned_provider ? (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ padding: 12, background: '#fff', borderRadius: 6, border: `1px solid ${Colors.lightGray}` }}>
                                    <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: Colors.sage }}>
                                      {getProviderName(r.assigned_provider)}
                                    </p>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ color: Colors.error, fontSize: 11 }}
                                      onClick={() => { handleUnassignProvider(r.id); }}
                                    >
                                      Unassign
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  {noZipCoverage && (
                                    <div style={{
                                      padding: 8, borderRadius: 6, background: Colors.warning + '20',
                                      color: Colors.warning, fontSize: 11, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6
                                    }}>
                                      ⚠️ No provider covers ZIP {homeZip}
                                    </div>
                                  )}
                                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>
                                    Assign Provider {matching.length > 0 && `(${matching.length} match)`}
                                  </label>
                                  <select
                                    className="form-select"
                                    style={{ width: '100%', padding: '6px 8px', fontSize: 12, marginBottom: 8 }}
                                    defaultValue=""
                                    onChange={e => { handleAssignProvider(r.id, e.target.value); }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <option value="" disabled>Select a provider...</option>
                                    {matching.length > 0 && (
                                      <optgroup label={`Matching (${matching.length})`}>
                                        {matching.map(p => {
                                          const atCapacity = p.max_jobs_per_day && p.active_job_count != null && p.active_job_count >= p.max_jobs_per_day;
                                          return (
                                            <option key={p.id} value={p.id} disabled={!!atCapacity}>
                                              {p.business_name || p.contact_name} {atCapacity ? ' — AT CAPACITY' : `[${p.active_job_count || 0} jobs]`}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}
                                    {allProvidersList.filter(p => !matching.find(m => m.id === p.id)).length > 0 && (
                                      <optgroup label="Other Available">
                                        {allProvidersList.filter(p => !matching.find(m => m.id === p.id)).map(p => {
                                          const atCapacity = p.max_jobs_per_day && p.active_job_count != null && p.active_job_count >= p.max_jobs_per_day;
                                          return (
                                            <option key={p.id} value={p.id} disabled={!!atCapacity}>
                                              {p.business_name || p.contact_name} {atCapacity ? ' — AT CAPACITY' : `[${p.active_job_count || 0} jobs]`}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    )}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="admin-empty">
              <p>No requests found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
