import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllProRequests, updateProRequest, getAllProProviders, sendNotification, supabase } from '@/services/supabase';
import { StatusColors, Colors } from '@/constants/theme';

interface Provider {
  id: string;
  business_name: string;
  contact_name: string;
  service_categories: string[];
  is_available: boolean;
}

export default function AdminProRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      getAllProRequests().then(setRequests).catch(() => {}),
      getAllProProviders().then(setProviders).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateProRequest(id, { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

      // Notify homeowner about meaningful status changes
      const request = requests.find(r => r.id === id);
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
      await updateProRequest(requestId, { provider_id: providerId, status: 'matched' });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, provider_id: providerId, status: 'matched' } : r));

      // Create linked pro_service_appointment so it shows in the provider portal
      const request = requests.find(r => r.id === requestId);
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
      const provider = providers.find(p => p.id === providerId);
      if (request?.user_id) {
        sendNotification({
          user_id: request.user_id,
          title: 'Pro Provider Assigned',
          body: `${provider?.business_name || provider?.contact_name || 'A pro provider'} has been assigned to your ${request.category || request.service_type} request. They will be in touch to schedule service.`,
          category: 'pro_service',
          action_url: '/pro-request',
        }).catch(() => {});
      }

      // Notify the provider about the new assignment
      if (provider) {
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

  const getMatchingProviders = (category: string) => {
    return providers.filter(p =>
      p.is_available && p.service_categories?.includes(category)
    );
  };

  const getProviderName = (providerId: string) => {
    const p = providers.find(pr => pr.id === providerId);
    return p ? p.business_name || p.contact_name : 'Unknown Provider';
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="page-wide">
      <div className="mb-lg">
        <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
        <h1>Pro Service Requests</h1>
        <p className="subtitle">{requests.length} total requests &bull; {providers.length} providers</p>
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
            const matching = getMatchingProviders(r.category || r.service_type);
            const allProvidersList = providers.filter(p => p.is_available);

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
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${Colors.lightGray}` }}>
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
                        Assign Provider {matching.length > 0 && `(${matching.length} match${matching.length !== 1 ? 'es' : ''} for ${r.category || r.service_type})`}
                      </label>
                      <select
                        className="form-select"
                        style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
                        defaultValue=""
                        onChange={e => handleAssignProvider(r.id, e.target.value)}
                      >
                        <option value="" disabled>Select a provider...</option>
                        {matching.length > 0 && (
                          <optgroup label="Matching Category">
                            {matching.map(p => (
                              <option key={p.id} value={p.id}>{p.business_name || p.contact_name} ({p.service_categories?.join(', ')})</option>
                            ))}
                          </optgroup>
                        )}
                        {allProvidersList.filter(p => !matching.find(m => m.id === p.id)).length > 0 && (
                          <optgroup label="Other Providers">
                            {allProvidersList.filter(p => !matching.find(m => m.id === p.id)).map(p => (
                              <option key={p.id} value={p.id}>{p.business_name || p.contact_name} ({p.service_categories?.join(', ')})</option>
                            ))}
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
