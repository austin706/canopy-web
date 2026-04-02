import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getNotifications, markNotificationRead } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

interface ProProvider {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  zip_codes: string[];
  is_available: boolean;
  rating?: number;
  total_reviews: number;
  assigned_clients?: number;
}

interface AssignedClient {
  id: string;
  full_name: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  subscription_tier: string;
  next_visit?: string;
}

interface UpcomingVisit {
  id: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  home?: { address: string; city: string; state: string };
  user?: { full_name: string };
}

interface JobStats {
  upcomingVisits: number;
  completedThisMonth: number;
  assignedClients: number;
}

export default function ProPortal() {
  const navigate = useNavigate();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';

  // Provider mode
  const [provider, setProvider] = useState<ProProvider | null>(null);
  const [stats, setStats] = useState<JobStats>({ upcomingVisits: 0, completedThisMonth: 0, assignedClients: 0 });
  const [myClients, setMyClients] = useState<AssignedClient[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<UpcomingVisit[]>([]);

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [newClients, setNewClients] = useState<{ id: string; full_name: string; email: string; address?: string; city?: string; hasFirstVisit: boolean }[]>([]);
  const [proNotifications, setProNotifications] = useState<any[]>([]);

  // Admin mode
  const [allProviders, setAllProviders] = useState<ProProvider[]>([]);
  const [adminStats, setAdminStats] = useState({ totalProviders: 0, availableProviders: 0, totalClients: 0, upcomingVisits: 0, pendingRequests: 0 });
  const [selectedProvider, setSelectedProvider] = useState<ProProvider | null>(null);
  const [providerClients, setProviderClients] = useState<AssignedClient[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignZip, setAssignZip] = useState('');
  const [editingZips, setEditingZips] = useState<string | null>(null);
  const [zipInput, setZipInput] = useState('');
  const [availableZips, setAvailableZips] = useState<{ zip: string; count: number }[]>([]);
  const [selectedZips, setSelectedZips] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      loadAdminDashboard();
    } else {
      loadProviderDashboard();
    }
  }, []);

  // ─── Admin: load provider overview with zip codes ───
  const loadAdminDashboard = async () => {
    try {
      const [providersRes, visitsRes, pendingReqRes] = await Promise.all([
        supabase.from('pro_providers').select('*'),
        supabase.from('pro_service_appointments').select('*', { count: 'exact', head: true })
          .gte('scheduled_date', new Date().toISOString().split('T')[0])
          .in('status', ['proposed', 'confirmed', 'scheduled']),
        supabase.from('pro_requests').select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'matched']),
      ]);

      const providers = providersRes.data || [];

      // Fetch all unique zip codes from homes with Pro/Pro+ subscribers
      const { data: homeZips } = await supabase
        .from('homes')
        .select('zip_code, profiles!inner(subscription_tier)')
        .not('zip_code', 'is', null);

      // Count homes per zip code (only Pro/Pro+ subscribers)
      const zipCounts: Record<string, number> = {};
      for (const h of (homeZips || [])) {
        const tier = (h as any).profiles?.subscription_tier;
        if (h.zip_code && (tier === 'pro' || tier === 'pro_plus')) {
          zipCounts[h.zip_code] = (zipCounts[h.zip_code] || 0) + 1;
        }
      }
      // Also include zips from ALL homes (even non-Pro) so admin can preemptively assign
      for (const h of (homeZips || [])) {
        if (h.zip_code && !zipCounts[h.zip_code]) {
          zipCounts[h.zip_code] = 0;
        }
      }
      const sortedZips = Object.entries(zipCounts)
        .map(([zip, count]) => ({ zip, count }))
        .sort((a, b) => b.count - a.count || a.zip.localeCompare(b.zip));
      setAvailableZips(sortedZips);

      // Count assigned Pro/Pro+ clients per provider, filtered by their zip codes
      for (const p of providers) {
        if (p.zip_codes && p.zip_codes.length > 0) {
          // Join through homes table to match provider zip codes with homeowner addresses
          const { count } = await supabase
            .from('profiles')
            .select('*, homes!inner(zip_code)', { count: 'exact', head: true })
            .in('subscription_tier', ['pro', 'pro_plus'])
            .in('homes.zip_code', p.zip_codes);
          p.assigned_clients = count || 0;
        } else {
          p.assigned_clients = 0;
        }
      }

      // Count total Pro/Pro+ clients
      const { count: totalProClients } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('subscription_tier', ['pro', 'pro_plus']);

      setAllProviders(providers);
      setAdminStats({
        totalProviders: providers.length,
        availableProviders: providers.filter(p => p.is_available).length,
        totalClients: totalProClients || 0,
        upcomingVisits: visitsRes.count || 0,
        pendingRequests: pendingReqRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Admin: load clients for a specific provider's zip codes
  const loadProviderClients = async (provider: ProProvider) => {
    setSelectedProvider(provider);
    setProviderClients([]);

    try {
      // Get homes in provider's zip codes, then match to Pro/Pro+ users
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, subscription_tier')
        .in('subscription_tier', ['pro', 'pro_plus'])
        .order('full_name');

      const { data: clients } = await query;

      // Also get their home info
      const clientList: AssignedClient[] = [];
      for (const c of (clients || [])) {
        const { data: homeData } = await supabase
          .from('homes')
          .select('id, address, city, state, zip_code')
          .eq('user_id', c.id)
          .single();

        // Filter by zip code if provider has zip codes set
        if (provider.zip_codes && provider.zip_codes.length > 0 && homeData?.zip_code) {
          if (!provider.zip_codes.includes(homeData.zip_code)) continue;
        }

        clientList.push({
          ...c,
          address: homeData?.address,
          city: homeData?.city,
          state: homeData?.state,
          zip_code: homeData?.zip_code,
        });
      }

      setProviderClients(clientList);
    } catch (err) {
      console.error('Error loading provider clients:', err);
    }
  };

  // Admin: update provider zip codes
  const handleSaveZips = async (providerId: string) => {
    const zips = zipInput.split(',').map(z => z.trim()).filter(z => /^\d{5}$/.test(z));
    if (zips.length === 0) {
      alert('Please enter valid 5-digit zip codes separated by commas.');
      return;
    }

    try {
      const { error } = await supabase
        .from('pro_providers')
        .update({ zip_codes: zips })
        .eq('id', providerId);

      if (error) throw error;

      setAllProviders(prev => prev.map(p => p.id === providerId ? { ...p, zip_codes: zips } : p));
      setEditingZips(null);
      setZipInput('');
    } catch (err: any) {
      alert('Failed to update zip codes: ' + err.message);
    }
  };

  // ─── Provider: load own dashboard ───
  const loadProviderDashboard = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      const { data: providerData, error: providerError } = await supabase
        .from('pro_providers')
        .select('*')
        .eq('user_id', authUser.user.id)
        .single();

      if (providerError || !providerData) {
        navigate('/pro-login');
        return;
      }

      setProvider(providerData);

      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Get upcoming service appointments
      const { data: apptData } = await supabase
        .from('pro_service_appointments')
        .select('*, home:home_id(address, city, state)')
        .eq('pro_provider_id', providerData.id)
        .gte('scheduled_date', today)
        .in('status', ['proposed', 'confirmed', 'scheduled'])
        .order('scheduled_date', { ascending: true })
        .limit(10);

      // Also get upcoming bimonthly visits
      const { data: bimonthlyData } = await supabase
        .from('pro_monthly_visits')
        .select('*, homeowner:homeowner_id(full_name), home:home_id(address, city, state)')
        .eq('pro_provider_id', providerData.id)
        .or(`proposed_date.gte.${today},confirmed_date.gte.${today}`)
        .in('status', ['proposed', 'confirmed'])
        .order('proposed_date', { ascending: true })
        .limit(10);

      // Merge into unified visit format
      const mergedVisits: UpcomingVisit[] = [];
      for (const a of (apptData || [])) {
        mergedVisits.push({
          id: a.id,
          title: a.title || 'Service Appointment',
          scheduled_date: a.scheduled_date,
          scheduled_time: a.scheduled_time || '',
          status: a.status,
          home: a.home as any,
        });
      }
      for (const v of (bimonthlyData || [])) {
        mergedVisits.push({
          id: v.id,
          title: 'Bimonthly Home Visit',
          scheduled_date: v.confirmed_date || v.proposed_date || '',
          scheduled_time: v.confirmed_start_time || v.proposed_time_slot || '',
          status: v.status,
          user: v.homeowner as any,
          home: v.home as any,
        });
      }
      mergedVisits.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
      const visitData = mergedVisits.slice(0, 10);

      setUpcomingVisits(visitData || []);

      // Get pending/matched pro_requests assigned to this provider
      const { data: requestData } = await supabase
        .from('pro_requests')
        .select('*, user:user_id(full_name, email), home:home_id(address, city, state)')
        .eq('provider_id', providerData.id)
        .in('status', ['matched', 'scheduled', 'pending'])
        .order('created_at', { ascending: false });

      setPendingRequests(requestData || []);

      // Stats — count from BOTH tables
      const [apptUpcoming, apptCompleted, visitUpcoming, visitCompleted] = await Promise.all([
        supabase
          .from('pro_service_appointments')
          .select('*', { count: 'exact', head: true })
          .eq('pro_provider_id', providerData.id)
          .gte('scheduled_date', today)
          .in('status', ['proposed', 'confirmed', 'scheduled']),
        supabase
          .from('pro_service_appointments')
          .select('*', { count: 'exact', head: true })
          .eq('pro_provider_id', providerData.id)
          .eq('status', 'completed')
          .gte('scheduled_date', monthStart),
        supabase
          .from('pro_monthly_visits')
          .select('*', { count: 'exact', head: true })
          .eq('pro_provider_id', providerData.id)
          .in('status', ['proposed', 'confirmed']),
        supabase
          .from('pro_monthly_visits')
          .select('*', { count: 'exact', head: true })
          .eq('pro_provider_id', providerData.id)
          .eq('status', 'completed')
          .gte('completed_at', monthStart),
      ]);
      const upcomingRes = { count: (apptUpcoming.count || 0) + (visitUpcoming.count || 0) };
      const completedRes = { count: (apptCompleted.count || 0) + (visitCompleted.count || 0) };

      // Get assigned clients count filtered by provider's zip codes
      let clientCount = 0;
      if (providerData.zip_codes && providerData.zip_codes.length > 0) {
        const { count } = await supabase
          .from('profiles')
          .select('*, homes!inner(zip_code)', { count: 'exact', head: true })
          .in('subscription_tier', ['pro', 'pro_plus'])
          .in('homes.zip_code', providerData.zip_codes);
        clientCount = count || 0;
      }

      // Load client list
      const { data: clients } = await supabase
        .from('profiles')
        .select('id, full_name, email, subscription_tier')
        .in('subscription_tier', ['pro', 'pro_plus']);

      const clientList: AssignedClient[] = [];
      for (const c of (clients || [])) {
        const { data: homeData } = await supabase
          .from('homes')
          .select('id, address, city, state, zip_code')
          .eq('user_id', c.id)
          .single();

        if (providerData.zip_codes?.length > 0 && homeData?.zip_code) {
          if (!providerData.zip_codes.includes(homeData.zip_code)) continue;
        }

        // Get next upcoming visit for this client
        const { data: nextVisit } = await supabase
          .from('pro_service_appointments')
          .select('scheduled_date')
          .eq('home_id', homeData?.id || '')
          .gte('scheduled_date', today)
          .order('scheduled_date', { ascending: true })
          .limit(1)
          .single();

        clientList.push({
          ...c,
          address: homeData?.address,
          city: homeData?.city,
          state: homeData?.state,
          zip_code: homeData?.zip_code,
          next_visit: nextVisit?.scheduled_date,
        });
      }

      setMyClients(clientList);

      // Identify new clients who haven't had their first visit yet
      const newClientsList: typeof newClients = [];
      for (const client of clientList) {
        const { count: visitCount } = await supabase
          .from('pro_monthly_visits')
          .select('*', { count: 'exact', head: true })
          .eq('homeowner_id', client.id)
          .eq('pro_provider_id', providerData.id);

        if (!visitCount || visitCount === 0) {
          // Check if a first visit has been proposed
          const { data: proposedVisit } = await supabase
            .from('pro_monthly_visits')
            .select('id')
            .eq('homeowner_id', client.id)
            .limit(1);

          newClientsList.push({
            id: client.id,
            full_name: client.full_name,
            email: client.email,
            address: client.address,
            city: client.city,
            hasFirstVisit: (proposedVisit && proposedVisit.length > 0) || false,
          });
        }
      }
      setNewClients(newClientsList);

      setStats({
        upcomingVisits: upcomingRes.count || 0,
        completedThisMonth: completedRes.count || 0,
        assignedClients: clientCount,
      });

      // Load notifications for this provider
      try {
        const notifs = await getNotifications(authUser.user.id);
        setProNotifications(notifs);
      } catch {}
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async () => {
    if (!provider) return;
    try {
      const newStatus = !provider.is_available;
      const { error } = await supabase
        .from('pro_providers')
        .update({ is_available: newStatus })
        .eq('id', provider.id);

      if (!error) {
        setProvider({ ...provider, is_available: newStatus });
      }
    } catch (err) {
      alert('Failed to update availability');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner" />
      </div>
    );
  }

  // ═══ Admin View ═══
  if (isAdmin) {
    return (
      <div className="page" style={{ maxWidth: 1000 }}>
        <div className="page-header">
          <div>
            <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back to Admin</button>
            <h1>Pro Provider Management</h1>
            <p className="subtitle">Manage Canopy contractors, zip code assignments, and client routing</p>
          </div>
        </div>

        {/* Admin Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Providers', value: adminStats.totalProviders, color: Colors.sage },
            { label: 'Available', value: adminStats.availableProviders, color: Colors.success },
            { label: 'Pro/Pro+ Clients', value: adminStats.totalClients, color: Colors.copper },
            { label: 'Pending Requests', value: adminStats.pendingRequests, color: Colors.warning },
            { label: 'Upcoming Visits', value: adminStats.upcomingVisits, color: Colors.info },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: s.color, marginBottom: 4 }}>{s.value}</div>
              <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          <button className="card" onClick={() => navigate('/pro-portal/visit-schedule')}
            style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: `2px solid ${Colors.sage}`, fontWeight: 600, fontSize: 15 }}>
            Visit Schedule
          </button>
          <button className="card" onClick={() => navigate('/pro-portal/job-queue')}
            style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: '2px solid transparent', fontWeight: 600, fontSize: 15 }}>
            All Service Requests
          </button>
          <button className="card" onClick={() => navigate('/pro-portal/quotes-invoices')}
            style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: '2px solid transparent', fontWeight: 600, fontSize: 15 }}>
            Quotes & Invoices
          </button>
        </div>

        {/* Provider List with Zip Code Management */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Canopy Providers</h2>
        {allProviders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: Colors.medGray }}>
            <p>No providers registered yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allProviders.map(p => (
              <div key={p.id} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: Colors.charcoal }}>{p.contact_name}</div>
                    <div style={{ fontSize: 13, color: Colors.medGray, marginTop: 2 }}>
                      {p.email} {p.phone ? `· ${p.phone}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      backgroundColor: p.is_available ? '#e8f5e9' : '#fce4ec',
                      color: p.is_available ? Colors.success : Colors.error || '#d32f2f',
                    }}>
                      {p.is_available ? 'Active' : 'Inactive'}
                    </span>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                      onClick={() => loadProviderClients(p)}>
                      View Clients
                    </button>
                  </div>
                </div>

                {/* Zip Codes */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal }}>Service Zip Codes:</span>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => {
                        if (editingZips === p.id) {
                          setEditingZips(null);
                        } else {
                          setEditingZips(p.id);
                          setSelectedZips(p.zip_codes || []);
                          setZipInput((p.zip_codes || []).join(', '));
                        }
                      }}>
                      {editingZips === p.id ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {editingZips === p.id ? (
                    <div>
                      {availableZips.length > 0 ? (
                        <div style={{
                          maxHeight: 200, overflowY: 'auto', border: `1px solid ${Colors.lightGray}`,
                          borderRadius: 8, padding: '8px 12px', marginBottom: 8, background: '#fff',
                        }}>
                          {availableZips.map(z => (
                            <label key={z.zip} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '4px 0', cursor: 'pointer', fontSize: 13,
                            }}>
                              <input
                                type="checkbox"
                                checked={selectedZips.includes(z.zip)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedZips(prev => [...prev, z.zip]);
                                  } else {
                                    setSelectedZips(prev => prev.filter(zip => zip !== z.zip));
                                  }
                                }}
                              />
                              <span style={{ fontWeight: 500 }}>{z.zip}</span>
                              {z.count > 0 && (
                                <span style={{ fontSize: 11, color: Colors.sage }}>
                                  ({z.count} Pro client{z.count !== 1 ? 's' : ''})
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <input
                            className="form-input"
                            value={zipInput}
                            onChange={e => setZipInput(e.target.value)}
                            placeholder="74101, 74104, 74105..."
                            style={{ flex: 1, fontSize: 13 }}
                          />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          if (availableZips.length > 0) {
                            // Save from checkbox selection
                            if (selectedZips.length === 0) {
                              alert('Please select at least one zip code.');
                              return;
                            }
                            supabase
                              .from('pro_providers')
                              .update({ zip_codes: selectedZips })
                              .eq('id', p.id)
                              .then(({ error }) => {
                                if (error) { alert('Failed to update: ' + error.message); return; }
                                setAllProviders(prev => prev.map(pr => pr.id === p.id ? { ...pr, zip_codes: selectedZips } : pr));
                                setEditingZips(null);
                                setSelectedZips([]);
                              });
                          } else {
                            handleSaveZips(p.id);
                          }
                        }}>Save</button>
                        <span style={{ fontSize: 12, color: Colors.medGray, alignSelf: 'center' }}>
                          {selectedZips.length} selected
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(p.zip_codes || []).length > 0 ? (
                        (p.zip_codes || []).map(zip => (
                          <span key={zip} style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                            backgroundColor: Colors.sageMuted, color: Colors.sage,
                          }}>{zip}</span>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: Colors.medGray, fontStyle: 'italic' }}>No zip codes assigned</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Provider's Clients */}
        {selectedProvider && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                Clients for {selectedProvider.contact_name}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedProvider(null)}>Close</button>
            </div>

            {providerClients.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 32, color: Colors.medGray }}>
                <p>No Pro/Pro+ clients in this provider's zip codes.</p>
              </div>
            ) : (
              <div className="card table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Address</th>
                      <th>Zip</th>
                      <th>Tier</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerClients.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.full_name || '—'}</td>
                        <td style={{ fontSize: 13 }}>{c.address ? `${c.address}, ${c.city}` : '—'}</td>
                        <td>{c.zip_code || '—'}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            backgroundColor: c.subscription_tier === 'pro_plus' ? '#EDE7F6' : Colors.sageMuted,
                            color: c.subscription_tier === 'pro_plus' ? '#7B1FA2' : Colors.sage,
                          }}>
                            {c.subscription_tier === 'pro_plus' ? 'Pro+' : 'Pro'}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: Colors.medGray }}>{c.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══ Provider View ═══
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1>Canopy Pro Dashboard</h1>
          <p className="subtitle">{provider?.contact_name || 'Welcome'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            onClick={toggleAvailability}
            style={{
              backgroundColor: provider?.is_available ? Colors.success : Colors.error || '#d32f2f',
              color: 'white', border: 'none', fontWeight: 600,
            }}
          >
            {provider?.is_available ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: Colors.sage, marginBottom: 4 }}>{stats.upcomingVisits}</div>
          <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>Upcoming Visits</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: Colors.copper, marginBottom: 4 }}>{stats.completedThisMonth}</div>
          <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>Completed This Month</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: Colors.warning, marginBottom: 4 }}>{stats.assignedClients}</div>
          <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>Assigned Clients</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        <button className="card" onClick={() => navigate('/pro-portal/visit-schedule')}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: `2px solid ${Colors.sage}`, fontWeight: 600, fontSize: 15 }}>
          Service Calendar
        </button>
        <button className="card" onClick={() => navigate('/pro-portal/job-queue')}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: '2px solid transparent', fontWeight: 600, fontSize: 15 }}>
          Visit Queue
        </button>
        <button className="card" onClick={() => navigate('/pro-portal/quotes-invoices')}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: '2px solid transparent', fontWeight: 600, fontSize: 15 }}>
          Quotes & Invoices
        </button>
      </div>

      {/* New Clients Needing First Visit */}
      {newClients.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            New Clients
            <span style={{
              marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 12,
              backgroundColor: `${Colors.copper}20`, color: Colors.copper, fontWeight: 600,
            }}>
              {newClients.length} need first visit
            </span>
          </h2>
          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12 }}>
            These Pro subscribers haven't had their first bimonthly visit yet. Schedule their orientation visit to get started.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {newClients.map(c => (
              <div key={c.id} className="card" style={{
                padding: '14px 18px',
                borderLeft: `4px solid ${Colors.copper}`,
                background: Colors.copperMuted,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: '0 0 4px' }}>
                      {c.full_name || c.email}
                      {c.hasFirstVisit && (
                        <span style={{
                          marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          backgroundColor: `${Colors.sage}20`, color: Colors.sage,
                        }}>
                          Visit Proposed
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                      {c.address ? `${c.address}, ${c.city}` : c.email}
                    </p>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/pro-portal/visit-schedule')}
                  >
                    {c.hasFirstVisit ? 'View' : 'Schedule Visit'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Visits */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Upcoming Visits</h2>
      {upcomingVisits.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: Colors.medGray }}>
          <p>No upcoming visits. Check your Service Calendar to propose new visits.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {upcomingVisits.map(v => (
            <div key={v.id} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: '0 0 4px' }}>
                    {v.title}
                    <span style={{
                      marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      backgroundColor: v.status === 'confirmed' ? '#e8f5e9' : '#FFF3CD',
                      color: v.status === 'confirmed' ? Colors.success : '#856404',
                    }}>
                      {v.status === 'proposed' ? 'Pending' : v.status}
                    </span>
                  </p>
                  <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                    {new Date(v.scheduled_date).toLocaleDateString()} at {v.scheduled_time}
                    {v.user?.full_name ? ` — ${v.user.full_name}` : ''}
                    {v.home ? ` · ${v.home.address}, ${v.home.city}` : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Service Requests */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Service Requests
        {pendingRequests.length > 0 && (
          <span style={{
            marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 12,
            backgroundColor: `${Colors.copper}20`, color: Colors.copper, fontWeight: 600,
          }}>
            {pendingRequests.length}
          </span>
        )}
      </h2>
      {pendingRequests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: Colors.medGray, marginBottom: 32 }}>
          <p>No pending service requests. New assignments will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {pendingRequests.map(r => {
            const statusColor = r.status === 'scheduled' ? Colors.sage
              : r.status === 'matched' ? Colors.info
              : Colors.warning;
            return (
              <div key={r.id} className="card" style={{ padding: '14px 18px', borderLeft: `4px solid ${statusColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: '0 0 4px' }}>
                      {(r.category || r.service_type || 'Service Request').replace(/^\w/, (c: string) => c.toUpperCase())}
                      <span style={{
                        marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        backgroundColor: statusColor + '20', color: statusColor,
                      }}>
                        {r.status}
                      </span>
                      {r.urgency && (
                        <span style={{
                          marginLeft: 4, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          backgroundColor: r.urgency === 'urgent' ? Colors.error + '20' : Colors.warning + '20',
                          color: r.urgency === 'urgent' ? Colors.error : Colors.warning,
                        }}>
                          {r.urgency}
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 4px' }}>
                      {r.description}
                    </p>
                    <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                      {r.user?.full_name || r.user?.email || 'Homeowner'}
                      {r.home ? ` · ${r.home.address}, ${r.home.city}` : ''}
                      {r.scheduled_date ? ` · Scheduled: ${new Date(r.scheduled_date).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                    onClick={() => navigate('/pro-portal/job-queue')}
                  >
                    Manage &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assigned Clients */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>My Clients</h2>
      {myClients.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: Colors.medGray }}>
          <p>No clients assigned to your service area yet.</p>
          <p style={{ fontSize: 12, margin: '8px 0 0' }}>
            Serving zip codes: {(provider?.zip_codes || []).join(', ') || 'None assigned — contact your admin'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {myClients.map(c => (
            <div key={c.id} className="card" style={{ padding: '12px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: '0 0 2px' }}>
                    {c.full_name || 'Unknown'}
                    <span style={{
                      marginLeft: 8, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      backgroundColor: c.subscription_tier === 'pro_plus' ? '#EDE7F6' : Colors.sageMuted,
                      color: c.subscription_tier === 'pro_plus' ? '#7B1FA2' : Colors.sage,
                    }}>
                      {c.subscription_tier === 'pro_plus' ? 'Pro+' : 'Pro'}
                    </span>
                  </p>
                  <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                    {c.address ? `${c.address}, ${c.city} ${c.state}` : c.email}
                    {c.next_visit ? ` — Next visit: ${new Date(c.next_visit).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Zip Codes */}
      <div className="card" style={{ padding: '16px 20px', backgroundColor: Colors.cream, marginBottom: 32 }}>
        <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: '0 0 6px' }}>My Service Area</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(provider?.zip_codes || []).length > 0 ? (
            (provider?.zip_codes || []).map(zip => (
              <span key={zip} style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                backgroundColor: Colors.sageMuted, color: Colors.sage,
              }}>{zip}</span>
            ))
          ) : (
            <span style={{ fontSize: 13, color: Colors.medGray }}>No zip codes assigned. Contact your Canopy admin.</span>
          )}
        </div>
      </div>

      {/* Notifications */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Alerts
        {proNotifications.filter(n => !n.read).length > 0 && (
          <span style={{
            marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 12,
            backgroundColor: `${Colors.error}20`, color: Colors.error, fontWeight: 600,
          }}>
            {proNotifications.filter(n => !n.read).length} new
          </span>
        )}
      </h2>
      {proNotifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: Colors.medGray }}>
          <p>No alerts yet. You'll be notified here when you're assigned new service requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {proNotifications.slice(0, 10).map(n => (
            <div
              key={n.id}
              className="card"
              style={{
                padding: '12px 16px',
                borderLeft: `3px solid ${n.read ? Colors.lightGray : Colors.copper}`,
                opacity: n.read ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <p style={{ fontSize: 14, fontWeight: n.read ? 500 : 700, margin: 0 }}>{n.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: Colors.medGray }}>
                    {n.created_at ? new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                  </span>
                  {!n.read && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={async () => {
                        try {
                          await markNotificationRead(n.id);
                          setProNotifications(prev =>
                            prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif)
                          );
                        } catch {}
                      }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>{n.body}</p>
              {n.action_url && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, padding: '4px 0', color: Colors.copper, marginTop: 4 }}
                  onClick={() => navigate(n.action_url)}
                >
                  View details &rarr;
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
