import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getClientHome } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, StatusColors } from '@/constants/theme';

interface ClientData {
  id: string;
  full_name: string;
  email: string;
  subscription_tier: string;
  created_at: string;
  home?: any;
}

export default function AgentPortal() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [tab, setTab] = useState<'clients' | 'codes'>('clients');
  const [clients, setClients] = useState<ClientData[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: agentData } = await supabase.from('agents').select('*').eq('email', user?.email).single();
        if (agentData) {
          const { data: profileData } = await supabase.from('profiles').select('*').eq('agent_id', agentData.id);
          const clientList = profileData || [];

          // Load homes for each client
          const clientsWithHomes = await Promise.all(
            clientList.map(async (c: any) => {
              let home = null;
              try { home = await getClientHome(c.id); } catch {}
              return { ...c, home };
            })
          );
          setClients(clientsWithHomes);

          const { data: codeData } = await supabase.from('gift_codes').select('*').eq('agent_id', agentData.id);
          setCodes(codeData || []);
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [user]);

  const activeCodes = codes.filter(c => !c.redeemed_by);
  const redeemedCodes = codes.filter(c => c.redeemed_by);

  const toggleClient = (id: string) => {
    setExpandedClient(prev => prev === id ? null : id);
  };

  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <h1>Agent Portal</h1>
          <p className="subtitle">Manage your clients and gift codes</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>Back to App &rarr;</button>
      </div>

      <div className="tabs mb-lg">
        <button className={`tab ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}>Clients ({clients.length})</button>
        <button className={`tab ${tab === 'codes' ? 'active' : ''}`} onClick={() => setTab('codes')}>Gift Codes ({codes.length})</button>
      </div>

      {loading ? <div className="text-center"><div className="spinner" /></div> : tab === 'clients' ? (
        <>
          {clients.length === 0 ? (
            <div className="empty-state"><div className="icon">&#128101;</div><h3>No clients yet</h3><p>Share gift codes with your clients to connect with them.</p></div>
          ) : (
            <div className="flex-col gap-md">
              {clients.map(c => (
                <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Client header row */}
                  <div
                    style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={() => toggleClient(c.id)}
                  >
                    <div className="flex items-center gap-md">
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: Colors.copper, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>
                        {c.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="fw-600">{c.full_name || '—'}</p>
                        <p className="text-xs text-gray">{c.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-md">
                      <span className="badge badge-copper">{c.subscription_tier || 'free'}</span>
                      {c.home ? (
                        <span className="badge badge-sage" style={{ fontSize: 11 }}>Home set up</span>
                      ) : (
                        <span className="badge" style={{ background: '#E5393520', color: '#C62828', fontSize: 11 }}>No home</span>
                      )}
                      <span style={{ color: 'var(--silver)', fontSize: 18, transform: expandedClient === c.id ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>&#9660;</span>
                    </div>
                  </div>

                  {/* Expanded client details */}
                  {expandedClient === c.id && (
                    <div style={{ borderTop: '1px solid var(--light-gray)', padding: '16px 20px', background: Colors.cream + '40' }}>
                      {c.home ? (
                        <div>
                          <div className="flex items-center justify-between mb-md">
                            <h3 style={{ fontSize: 16 }}>&#127968; {c.home.address}</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/agent-portal/client/${c.id}`)}>Edit Home</button>
                          </div>
                          <p className="text-sm text-gray mb-md">{c.home.city}, {c.home.state} {c.home.zip_code}</p>
                          <div className="grid-4" style={{ gap: 12 }}>
                            <div>
                              <p className="text-xs text-gray">Year Built</p>
                              <p className="fw-600 text-sm">{c.home.year_built || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray">Size</p>
                              <p className="fw-600 text-sm">{c.home.square_footage?.toLocaleString() || '—'} sqft</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray">Layout</p>
                              <p className="fw-600 text-sm">{c.home.bedrooms}bd / {c.home.bathrooms}ba</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray">Roof</p>
                              <p className="fw-600 text-sm">{c.home.roof_type?.replace(/_/g, ' ') || '—'}</p>
                            </div>
                          </div>
                          <div className="grid-4 mt-sm" style={{ gap: 12 }}>
                            <div>
                              <p className="text-xs text-gray">Heating</p>
                              <p className="fw-600 text-sm">{c.home.heating_type?.replace(/_/g, ' ') || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray">Cooling</p>
                              <p className="fw-600 text-sm">{c.home.cooling_type?.replace(/_/g, ' ') || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray">Lawn</p>
                              <p className="fw-600 text-sm">{c.home.lawn_type?.replace(/_/g, ' ') || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray">Features</p>
                              <p className="fw-600 text-sm">
                                {[c.home.has_pool && 'Pool', c.home.has_deck && 'Deck', c.home.has_sprinkler_system && 'Sprinklers', c.home.has_fireplace && 'Fireplace'].filter(Boolean).join(', ') || '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                          <p className="text-gray mb-md">This client hasn't set up their home yet.</p>
                          <button className="btn btn-primary" onClick={() => navigate(`/agent-portal/client/${c.id}`)}>Set Up Home for {c.full_name?.split(' ')[0] || 'Client'}</button>
                        </div>
                      )}
                      <p className="text-xs text-gray mt-md">Joined: {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid-2 mb-lg">
            <div className="card stat-card">
              <div className="stat-value" style={{ color: Colors.copper }}>{activeCodes.length}</div>
              <div className="stat-label">Available Codes</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: Colors.success }}>{redeemedCodes.length}</div>
              <div className="stat-label">Redeemed Codes</div>
            </div>
          </div>

          {activeCodes.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Available Codes</h2>
              <div className="card table-container mb-lg">
                <table>
                  <thead><tr><th>Code</th><th>Tier</th><th>Duration</th><th>Expires</th></tr></thead>
                  <tbody>
                    {activeCodes.map(c => (
                      <tr key={c.id}>
                        <td><code style={{ background: Colors.cream, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{c.code}</code></td>
                        <td><span className="badge badge-copper">{c.tier}</span></td>
                        <td>{c.duration_months} months</td>
                        <td className="text-sm text-gray">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {redeemedCodes.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Redeemed Codes</h2>
              <div className="card table-container">
                <table>
                  <thead><tr><th>Code</th><th>Tier</th><th>Redeemed At</th></tr></thead>
                  <tbody>
                    {redeemedCodes.map(c => (
                      <tr key={c.id}>
                        <td><code style={{ opacity: 0.5 }}>{c.code}</code></td>
                        <td><span className="badge badge-gray">{c.tier}</span></td>
                        <td className="text-sm text-gray">{c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
