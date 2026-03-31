import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getClientHome, createGiftCodes, getNotifications, markNotificationRead } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, StatusColors } from '@/constants/theme';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

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
  const [tab, setTab] = useState<'clients' | 'new-client' | 'codes' | 'notifications'>('clients');
  const [clients, setClients] = useState<ClientData[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [agentNotifications, setAgentNotifications] = useState<any[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // New client setup form
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({
    name: '', email: '', tier: 'home',
  });
  const [homeForm, setHomeForm] = useState({
    address: '', city: '', state: '', zip_code: '',
    year_built: '', square_footage: '',
    stories: '1', bedrooms: '3', bathrooms: '2', garage_spaces: '2',
    roof_type: '', roof_age_years: '',
    heating_type: '', cooling_type: '',
    has_pool: false, has_deck: false, has_sprinkler_system: false, has_fireplace: false,
    lawn_type: 'none',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data: agentData } = await supabase.from('agents').select('*').eq('email', user?.email).single();
        if (agentData) {
          setAgentId(agentData.id);
          const { data: profileData } = await supabase.from('profiles').select('*').eq('agent_id', agentData.id);
          const clientList = profileData || [];

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

          // Load notifications for this agent (using their auth uid, not agents.id)
          if (user?.id) {
            try {
              const notifs = await getNotifications(user.id);
              setAgentNotifications(notifs);
            } catch {}
          }
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

  // ─── New Client Setup ───
  const handleCreateClient = async () => {
    if (!agentId) return;
    if (!clientForm.name.trim()) { alert('Client name is required'); return; }
    if (!homeForm.address.trim()) { alert('Home address is required'); return; }

    setCreating(true);
    try {
      const code = generateCode();
      const expiry = new Date(Date.now() + 365 * 86400000);

      // Build pending home data
      const pendingHome: Record<string, any> = {
        address: homeForm.address,
        city: homeForm.city,
        state: homeForm.state,
        zip_code: homeForm.zip_code,
        stories: parseInt(homeForm.stories) || 1,
        bedrooms: parseInt(homeForm.bedrooms) || 3,
        bathrooms: parseInt(homeForm.bathrooms) || 2,
        garage_spaces: parseInt(homeForm.garage_spaces) || 0,
        has_pool: homeForm.has_pool,
        has_deck: homeForm.has_deck,
        has_sprinkler_system: homeForm.has_sprinkler_system,
        has_fireplace: homeForm.has_fireplace,
        lawn_type: homeForm.lawn_type,
      };
      if (homeForm.year_built) pendingHome.year_built = parseInt(homeForm.year_built);
      if (homeForm.square_footage) pendingHome.square_footage = parseInt(homeForm.square_footage);
      if (homeForm.roof_type) pendingHome.roof_type = homeForm.roof_type;
      if (homeForm.roof_age_years) pendingHome.roof_age_years = parseInt(homeForm.roof_age_years);
      if (homeForm.heating_type) pendingHome.heating_type = homeForm.heating_type;
      if (homeForm.cooling_type) pendingHome.cooling_type = homeForm.cooling_type;

      const giftCodeData = [{
        id: crypto.randomUUID(),
        code,
        tier: clientForm.tier,
        agent_id: agentId,
        duration_months: 12,
        expires_at: expiry.toISOString(),
        created_at: new Date().toISOString(),
        client_name: clientForm.name.trim(),
        client_email: clientForm.email.trim() || null,
        pending_home: pendingHome,
      }];

      const created = await createGiftCodes(giftCodeData);
      setCodes(prev => [...created, ...prev]);
      setCreatedCode(code);
      setSetupStep(3);
    } catch (e: any) {
      alert('Failed to create invite: ' + (e.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  const resetSetupForm = () => {
    setSetupStep(1);
    setCreatedCode(null);
    setClientForm({ name: '', email: '', tier: 'home' });
    setHomeForm({
      address: '', city: '', state: '', zip_code: '',
      year_built: '', square_footage: '',
      stories: '1', bedrooms: '3', bathrooms: '2', garage_spaces: '2',
      roof_type: '', roof_age_years: '',
      heating_type: '', cooling_type: '',
      has_pool: false, has_deck: false, has_sprinkler_system: false, has_fireplace: false,
      lawn_type: 'none',
    });
  };

  const copyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      alert('Code copied to clipboard!');
    }
  };

  // ─── Render ───
  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <h1>Agent Portal</h1>
          <p className="subtitle">Manage your clients and gift codes</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => navigate('/agent-portal/profile')}>Edit Profile</button>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>Back to App &rarr;</button>
        </div>
      </div>

      <div className="tabs mb-lg">
        <button className={`tab ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}>Clients ({clients.length})</button>
        <button className={`tab ${tab === 'new-client' ? 'active' : ''}`} onClick={() => { setTab('new-client'); resetSetupForm(); }}>+ New Client</button>
        <button className={`tab ${tab === 'codes' ? 'active' : ''}`} onClick={() => setTab('codes')}>Gift Codes ({codes.length})</button>
        <button className={`tab ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')} style={{ position: 'relative' }}>
          Alerts
          {agentNotifications.filter(n => !n.read).length > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 8, height: 8, borderRadius: '50%',
              background: Colors.error,
            }} />
          )}
        </button>
      </div>

      {loading ? <div className="text-center"><div className="spinner" /></div> :

      // ═══ Clients Tab ═══
      tab === 'clients' ? (
        <>
          {clients.length === 0 ? (
            <div className="empty-state">
              <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div>
              <h3>No clients yet</h3>
              <p>Use the "+ New Client" tab to set up a home and send an invite code.</p>
            </div>
          ) : (
            <div className="flex-col gap-md">
              {clients.map(c => (
                <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                      <span style={{ color: 'var(--silver)', fontSize: 12, transform: expandedClient === c.id ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>&#9662;</span>
                    </div>
                  </div>

                  {expandedClient === c.id && (
                    <div style={{ borderTop: '1px solid var(--light-gray)', padding: '16px 20px', background: Colors.cream + '40' }}>
                      {c.home ? (
                        <div>
                          <div className="flex items-center justify-between mb-md">
                            <h3 style={{ fontSize: 16 }}>{c.home.address}</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/agent-portal/client/${c.id}`)}>Edit Home</button>
                          </div>
                          <p className="text-sm text-gray mb-md">{c.home.city}, {c.home.state} {c.home.zip_code}</p>
                          <div className="grid-4" style={{ gap: 12 }}>
                            <div><p className="text-xs text-gray">Year Built</p><p className="fw-600 text-sm">{c.home.year_built || '—'}</p></div>
                            <div><p className="text-xs text-gray">Size</p><p className="fw-600 text-sm">{c.home.square_footage?.toLocaleString() || '—'} sqft</p></div>
                            <div><p className="text-xs text-gray">Layout</p><p className="fw-600 text-sm">{c.home.bedrooms}bd / {c.home.bathrooms}ba</p></div>
                            <div><p className="text-xs text-gray">Roof</p><p className="fw-600 text-sm">{c.home.roof_type?.replace(/_/g, ' ') || '—'}</p></div>
                          </div>
                          <div className="grid-4 mt-sm" style={{ gap: 12 }}>
                            <div><p className="text-xs text-gray">Heating</p><p className="fw-600 text-sm">{c.home.heating_type?.replace(/_/g, ' ') || '—'}</p></div>
                            <div><p className="text-xs text-gray">Cooling</p><p className="fw-600 text-sm">{c.home.cooling_type?.replace(/_/g, ' ') || '—'}</p></div>
                            <div><p className="text-xs text-gray">Lawn</p><p className="fw-600 text-sm">{c.home.lawn_type?.replace(/_/g, ' ') || '—'}</p></div>
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
      ) :

      // ═══ New Client Tab ═══
      tab === 'new-client' ? (
        <div style={{ maxWidth: 600 }}>
          {/* Step indicator */}
          <div className="flex items-center gap-sm mb-lg" style={{ justifyContent: 'center' }}>
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-sm">
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600,
                  backgroundColor: setupStep >= s ? Colors.copper : Colors.lightGray,
                  color: setupStep >= s ? '#fff' : Colors.medGray,
                }}>
                  {setupStep > s ? '✓' : s}
                </div>
                {s < 3 && <div style={{ width: 40, height: 2, backgroundColor: setupStep > s ? Colors.copper : Colors.lightGray }} />}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray mb-lg">
            {setupStep === 1 ? 'Client Information' : setupStep === 2 ? 'Home Details' : 'Invite Code Ready'}
          </p>

          {/* Step 1: Client Info */}
          {setupStep === 1 && (
            <div className="card">
              <h2 style={{ fontSize: 18, marginBottom: 20 }}>Client Information</h2>
              <div className="form-group">
                <label>Client Name *</label>
                <input className="form-input" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} placeholder="Jane Smith" />
              </div>
              <div className="form-group">
                <label>Client Email</label>
                <input className="form-input" type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} placeholder="jane@example.com (optional)" />
              </div>
              <div className="form-group">
                <label>Subscription Tier</label>
                <select className="form-select" value={clientForm.tier} onChange={e => setClientForm({ ...clientForm, tier: e.target.value })}>
                  <option value="home">Home</option>
                  <option value="pro">Pro</option>
                  <option value="pro_plus">Pro+</option>
                </select>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => {
                if (!clientForm.name.trim()) { alert('Client name is required'); return; }
                setSetupStep(2);
              }}>
                Next: Home Details &rarr;
              </button>
            </div>
          )}

          {/* Step 2: Home Details */}
          {setupStep === 2 && (
            <div className="card">
              <h2 style={{ fontSize: 18, marginBottom: 20 }}>Home Details for {clientForm.name}</h2>

              <div className="form-group">
                <label>Address *</label>
                <input className="form-input" value={homeForm.address} onChange={e => setHomeForm({ ...homeForm, address: e.target.value })} placeholder="123 Main St" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>City</label>
                  <input className="form-input" value={homeForm.city} onChange={e => setHomeForm({ ...homeForm, city: e.target.value })} placeholder="Tulsa" />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input className="form-input" value={homeForm.state} onChange={e => setHomeForm({ ...homeForm, state: e.target.value })} placeholder="OK" maxLength={2} />
                </div>
                <div className="form-group">
                  <label>ZIP</label>
                  <input className="form-input" value={homeForm.zip_code} onChange={e => setHomeForm({ ...homeForm, zip_code: e.target.value })} placeholder="74103" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Year Built</label>
                  <input className="form-input" type="number" value={homeForm.year_built} onChange={e => setHomeForm({ ...homeForm, year_built: e.target.value })} placeholder="2005" />
                </div>
                <div className="form-group">
                  <label>Square Footage</label>
                  <input className="form-input" type="number" value={homeForm.square_footage} onChange={e => setHomeForm({ ...homeForm, square_footage: e.target.value })} placeholder="2400" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Stories</label>
                  <select className="form-select" value={homeForm.stories} onChange={e => setHomeForm({ ...homeForm, stories: e.target.value })}>
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Beds</label>
                  <input className="form-input" type="number" value={homeForm.bedrooms} onChange={e => setHomeForm({ ...homeForm, bedrooms: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Baths</label>
                  <input className="form-input" type="number" value={homeForm.bathrooms} onChange={e => setHomeForm({ ...homeForm, bathrooms: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Garage</label>
                  <input className="form-input" type="number" value={homeForm.garage_spaces} onChange={e => setHomeForm({ ...homeForm, garage_spaces: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Roof Type</label>
                  <select className="form-select" value={homeForm.roof_type} onChange={e => setHomeForm({ ...homeForm, roof_type: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="asphalt_shingle">Asphalt Shingle</option>
                    <option value="metal">Metal</option>
                    <option value="tile">Tile</option>
                    <option value="slate">Slate</option>
                    <option value="flat">Flat</option>
                    <option value="wood_shake">Wood Shake</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Roof Age (years)</label>
                  <input className="form-input" type="number" value={homeForm.roof_age_years} onChange={e => setHomeForm({ ...homeForm, roof_age_years: e.target.value })} placeholder="10" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Heating</label>
                  <select className="form-select" value={homeForm.heating_type} onChange={e => setHomeForm({ ...homeForm, heating_type: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="central_gas">Central Gas</option>
                    <option value="central_electric">Central Electric</option>
                    <option value="heat_pump">Heat Pump</option>
                    <option value="boiler">Boiler</option>
                    <option value="radiant">Radiant</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Cooling</label>
                  <select className="form-select" value={homeForm.cooling_type} onChange={e => setHomeForm({ ...homeForm, cooling_type: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="central_ac">Central AC</option>
                    <option value="heat_pump">Heat Pump</option>
                    <option value="window_units">Window Units</option>
                    <option value="evaporative">Evaporative</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Lawn Type</label>
                <select className="form-select" value={homeForm.lawn_type} onChange={e => setHomeForm({ ...homeForm, lawn_type: e.target.value })}>
                  <option value="none">None</option>
                  <option value="bermuda">Bermuda</option>
                  <option value="fescue">Fescue</option>
                  <option value="bluegrass">Bluegrass</option>
                  <option value="zoysia">Zoysia</option>
                  <option value="st_augustine">St. Augustine</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {([
                  ['has_pool', 'Pool'],
                  ['has_deck', 'Deck / Patio'],
                  ['has_sprinkler_system', 'Sprinklers'],
                  ['has_fireplace', 'Fireplace'],
                ] as const).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={(homeForm as any)[key]}
                      onChange={e => setHomeForm({ ...homeForm, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="flex gap-sm" style={{ marginTop: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSetupStep(1)}>&larr; Back</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreateClient} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Invite Code'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success — show code */}
          {setupStep === 3 && createdCode && (
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${Colors.success}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
                ✓
              </div>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Invite Ready!</h2>
              <p className="text-gray" style={{ marginBottom: 24 }}>
                Share this code with {clientForm.name}. When they sign up and redeem it, their home will be pre-configured and they'll be connected to you as their agent.
              </p>

              <div style={{
                backgroundColor: Colors.cream,
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 24,
              }}>
                <p className="text-xs text-gray" style={{ marginBottom: 8 }}>Invite Code</p>
                <code style={{
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: Colors.copper,
                }}>
                  {createdCode}
                </code>
              </div>

              <div style={{ backgroundColor: Colors.sageMuted, borderRadius: 8, padding: 16, marginBottom: 24, textAlign: 'left' }}>
                <p className="text-sm" style={{ marginBottom: 4 }}><strong>Client:</strong> {clientForm.name}</p>
                <p className="text-sm" style={{ marginBottom: 4 }}><strong>Home:</strong> {homeForm.address}, {homeForm.city}, {homeForm.state} {homeForm.zip_code}</p>
                <p className="text-sm"><strong>Tier:</strong> {clientForm.tier}</p>
              </div>

              <div className="flex gap-sm">
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={copyCode}>Copy Code</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { resetSetupForm(); setTab('clients'); }}>Done</button>
              </div>
            </div>
          )}
        </div>
      ) :

      // ═══ Gift Codes Tab ═══
      tab === 'codes' ? (
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
                  <thead><tr><th>Code</th><th>Tier</th><th>Client</th><th>Duration</th><th>Expires</th></tr></thead>
                  <tbody>
                    {activeCodes.map(c => (
                      <tr key={c.id}>
                        <td><code style={{ background: Colors.cream, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{c.code}</code></td>
                        <td><span className="badge badge-copper">{c.tier}</span></td>
                        <td className="text-sm">{c.client_name || '—'}</td>
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
                  <thead><tr><th>Code</th><th>Tier</th><th>Client</th><th>Redeemed At</th></tr></thead>
                  <tbody>
                    {redeemedCodes.map(c => (
                      <tr key={c.id}>
                        <td><code style={{ opacity: 0.5 }}>{c.code}</code></td>
                        <td><span className="badge badge-gray">{c.tier}</span></td>
                        <td className="text-sm">{c.client_name || '—'}</td>
                        <td className="text-sm text-gray">{c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) :

      // ═══ Notifications Tab ═══
      (
        <>
          <div className="flex items-center justify-between mb-md">
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Alerts</h2>
            {agentNotifications.filter(n => !n.read).length > 0 && (
              <span className="text-sm text-gray">{agentNotifications.filter(n => !n.read).length} unread</span>
            )}
          </div>

          {agentNotifications.length === 0 ? (
            <div className="empty-state">
              <div className="icon" style={{ fontSize: 32, color: Colors.medGray }}>--</div>
              <h3>No alerts yet</h3>
              <p>You'll be notified here when clients activate sale prep, request services, or need attention.</p>
            </div>
          ) : (
            <div className="flex-col gap-sm">
              {agentNotifications.map(n => (
                <div
                  key={n.id}
                  className="card"
                  style={{
                    padding: '14px 18px',
                    borderLeft: `3px solid ${n.read ? Colors.lightGray : Colors.copper}`,
                    opacity: n.read ? 0.7 : 1,
                    background: n.read ? undefined : `${Colors.copperMuted}40`,
                  }}
                >
                  <div className="flex items-center justify-between mb-xs">
                    <p style={{ fontSize: 15, fontWeight: n.read ? 500 : 700 }}>{n.title}</p>
                    <div className="flex items-center gap-sm">
                      <span className="text-xs text-gray">
                        {n.created_at ? new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                      </span>
                      {!n.read && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={async () => {
                            try {
                              await markNotificationRead(n.id);
                              setAgentNotifications(prev =>
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
                  <p className="text-sm text-gray">{n.body}</p>
                  {n.action_url && (
                    <button
                      className="btn btn-ghost btn-sm mt-sm"
                      style={{ fontSize: 12, padding: '4px 0', color: Colors.copper }}
                      onClick={() => navigate(n.action_url)}
                    >
                      View details &rarr;
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
