import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'matched' | 'in_progress' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    Promise.all([
      getAllProRequests().then(async (reqs) => {
        // Enrich with home zip_code for ZIP matching
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
      }).catch(() => {}),
      getAllProProviders().then(async (provs: any[]) => {
        // Enrich providers with active job counts for availability
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
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const request = requests.find(r => r.id === id);
      const oldStatus = request?.status;

      await updateProRequest(id, { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

      // Log status change
      logAdminAction('request.status_change', 'pro_request', id, { old_status: oldStatus, new_status: status }).catch(() => {});

      // Notify homeowner about meaningful status changes
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

      await updateProRequest(requestId, { provider_id: providerId, status: 'matched' });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, provider_id: providerId, status: 'matched' } : r));

      // Log provider assignment
      logAdminAction('request.assign', 'pro_request', requestId, { provider_name: assignedProvider?.business_name || assignedProvider?.contact_name, category }).catch(() => {});

      // Create linked pro_service_appointment so it shows in the provider portal
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

      // Notify the homeowner that a provider has been assigned
      if (request?.user_id) {
        sendNotification({
          user_id: request.user_id,
          title: 'Pro Provider Assigned',
          body: `${assignedProvider?.business_name || assignedProvider?.contact_name || 'A pro provider'} has been assigned to your ${request.category || request.service_type} request. They will be in touch to schedule service.`,
          category: 'pro_service',
          action_url: '/pro-request',
        }).catch(() => {});
      }

      // Notify the provider about the new assignment
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
      await updateProRequest(requestId, { provider_id: null, status: 'pending' });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, provider_id: null, status: 'pending' } : r));
    } catch (e: any) { alert(e.message); }
  };

  const getMatchingProviders = (category: string, homeZip?: string) => {
    const categoryMatches = providers.filter(p =>
      p.is_available && p.service_categories?.includes(category)
    );
    if (!homeZip) return categoryMatches;
    // Prefer providers whose zip_codes array includes the home's ZIP
    const zipMatches = categoryMatches.filter(p =>
      p.zip_codes?.includes(homeZip)
    );
    return zipMatches.length > 0 ? zipMatches : categoryMatches;
  };

  // Check if there are ANY providers matching both category + ZIP for a request
  const checkProviderCoverage = async (request: any) => {
    const homeZip = request.home?.zip_code;
    const category = request.category || request.service_type;
    const matching = providers.filter(p =>
      p.is_available &&
      p.service_categories?.includes(category) &&
      (!homeZip || p.zip_codes?.includes(homeZip))
    );
    if (matching.length === 0 && homeZip) {
      // Alert admins — no provider covers this ZIP + category combo
      try {
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
        for (const admin of (admins || [])) {
          await sendNotification({
            user_id: admin.id,
            title: `No Provider Coverage: ${category}`,
            body: `No available provider covers ZIP ${homeZip} for ${category} service. Request from ${request.user?.full_name || request.user?.email || 'a homeowner'} needs manual assignment.`,
            category: 'admin',
            action_url: '/admin/pro-requests',
          });
        }
      } catch { /* Non-blocking */ }
    }
    return matching.length;
  };

  const getProviderName = (providerId: string) => {
    const p = providers.find(pr => pr.id === providerId);
    return p ? p.business_name || p.contact_name : 'Unknown Provider';
  };

  // Apply search and status filters
  const filtered = requests.filter(r => {
    // Status filter
    const statusMatch = statusFilter === 'all' || r.status === statusFilter;

    // Search filter: match homeowner email, service category, or provider business name
    let searchMatch = true;
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      const homeownerEmail = r.user?.email?.toLowerCase() || '';
      const category = (r.category || r.service_type || '').toLowerCase();
      const providerName = r.provider_id ? (getProviderName(r.provider_id) || '').toLowerCase() : '';

      searchMatch = homeownerEmail.includes(searchLower) ||
                    category.includes(searchLower) ||
                    providerName.includes(searchLower);
    }

    return statusMatch && searchMatch;
  });

  return (
    <div className="page-wide">
      <div className="mb-lg">
        <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
        <h1>Pro Service Requests</h1>
        <p className="subtitle">{requests.length} total requests &bull; {providers.length} providers</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex gap-md mb-lg" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>Search</label>
          <input
            type="text"
            className="form-input"
            placeholder="Email, category, or provider..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
          />
        </div>
        <div style={{ minWidth: 150 }}>
          <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>Status</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as string)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="matched">Matched</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="tabs mb-lg">
        {['all', 'pending', 'matched', 'scheduled', 'completed'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? requests.length : requests.filter(r => r.status === f).length})
          </button>
        ))}
      </div>

      {loading ? <div className="text-center"><div className="spinner" /></div> : (
        <div className="flex-col gap-md">
          {filtered.map(r => {
            const homeZip = r.home?.zip_code;
            const matching = getMatchingProviders(r.category || r.service_type, homeZip);
            const allProvidersList = providers.filter(p => p.is_available);
            const noZipCoverage = homeZip && matching.length === 0;

            return (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between mb-sm">
                  <div>
                    <p style={{ fontWeight: 600 }}>{r.category || r.service_type}</p>
                    <p className="text-xs text-gray">User: {r.user?.full_name || r.user?.email || '—'}</p>
                  </div>
                  <div className="flex items-center gap-sm">
                    <span className="badge" style={{ background: (StatusColors[r.status] || '#ccc') + '20', color: StatusColors[r.status] }}>{r.status}</span>
                    <select className="form-select" value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)} style={{ width: 130, padding: '4px 8px', fontSize: 12 }}>
                      <option value="pending">Pending</option><option value="matched">Matched</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <p className="text-sm text-gray">{r.description}</p>

                <div className="flex gap-lg mt-sm text-xs text-gray">
                  <span>Submitted: {new Date(r.created_at).toLocaleDateString()}</span>
                  {r.preferred_date && <span>Preferred: {new Date(r.preferred_date).toLocaleDateString()}</span>}
                </div>

                {/* Provider Assignment */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid var(--color-border)` }}>
                  {r.provider_id ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray">Assigned to: </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: Colors.sage }}>{getProviderName(r.provider_id)}</span>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: Colors.error }}
                        onClick={() => handleUnassignProvider(r.id)}
                      >
                        Unassign
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>
                        Assign Provider {matching.length > 0 && `(${matching.length} match${matching.length !== 1 ? 'es' : ''} for ${r.category || r.service_type}${homeZip ? ` in ${homeZip}` : ''})`}
                      </label>
                      {noZipCoverage && (
                        <div style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--color-warning)', opacity: 0.15, color: 'var(--color-warning)', fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          ⚠️ No provider covers ZIP {homeZip} for {r.category || r.service_type}. Manual assignment required.
                        </div>
                      )}
                      <select
                        className="form-select"
                        style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
                        defaultValue=""
                        onChange={e => handleAssignProvider(r.id, e.target.value)}
                      >
                        <option value="" disabled>Select a provider...</option>
                        {matching.length > 0 && (
                          <optgroup label={`Matching Category${homeZip ? ' & ZIP' : ''}`}>
                            {matching.map(p => {
                              const atCapacity = p.max_jobs_per_day && p.active_job_count != null && p.active_job_count >= p.max_jobs_per_day;
                              return (
                                <option key={p.id} value={p.id} disabled={!!atCapacity}>
                                  {p.business_name || p.contact_name} ({p.service_categories?.join(', ')})
                                  {p.active_job_count != null ? ` [${p.active_job_count}${p.max_jobs_per_day ? `/${p.max_jobs_per_day}` : ''} jobs]` : ''}
                                  {atCapacity ? ' — AT CAPACITY' : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                        {allProvidersList.filter(p => !matching.find(m => m.id === p.id)).length > 0 && (
                          <optgroup label="Other Providers">
                            {allProvidersList.filter(p => !matching.find(m => m.id === p.id)).map(p => {
                              const atCapacity = p.max_jobs_per_day && p.active_job_count != null && p.active_job_count >= p.max_jobs_per_day;
                              return (
                                <option key={p.id} value={p.id} disabled={!!atCapacity}>
                                  {p.business_name || p.contact_name} ({p.service_categories?.join(', ')})
                                  {p.active_job_count != null ? ` [${p.active_job_count}${p.max_jobs_per_day ? `/${p.max_jobs_per_day}` : ''} jobs]` : ''}
                                  {atCapacity ? ' — AT CAPACITY' : ''}
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
            );
          })}
          {filtered.length === 0 && <div className="empty-state"><div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div><h3>No requests</h3></div>}
        </div>
      )}
    </div>
  );
}
