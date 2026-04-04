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
  const [tab, setTab] = useState<'clients' | 'new-client' | 'codes' | 'notifications' | 'analytics'>('clients');
  const [clients, setClients] = useState<ClientData[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [agentNotifications, setAgentNotifications] = useState<any[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Client notes
  const [clientNotes, setClientNotes] = useState<Record<string, any[]>>({});
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState('general');
  const [savingNote, setSavingNote] = useState(false);

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

  const toggleClient = async (id: string) => {
    const newExpanded = expandedClient === id ? null : id;
    setExpandedClient(newExpanded);
    // Load notes when expanding a client
    if (newExpanded && agentId && !clientNotes[id]) {
      try {
        const { data } = await supabase
          .from('agent_client_notes')
          .select('*')
          .eq('agent_id', agentId)
          .eq('client_id', id)
          .order('created_at', { ascending: false });
        setClientNotes(prev => ({ ...prev, [id]: data || [] }));
      } catch {}
    }
  };

  const handleAddNote = async (clientId: string) => {
    if (!agentId || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from('agent_client_notes')
        .insert({ agent_id: agentId, client_id: clientId, note: newNote.trim(), category: noteCategory })
        .select()
        .single();
      if (error) throw error;
      setClientNotes(prev => ({ ...prev, [clientId]: [data, ...(prev[clientId] || [])] }));
      setNewNote('');
      setNoteCategory('general');
    } catch (err: any) {
      alert('Failed to save note: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (clientId: string, noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await supabase.from('agent_client_notes').delete().eq('id', noteId);
      setClientNotes(prev => ({ ...prev, [clientId]: (prev[clientId] || []).filter(n => n.id !== noteId) }));
    } catch { alert('Failed to delete note'); }
  };

  // Expiration helpers
  const getDaysUntilExpiry = (expiresAt: string): number => {
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getExpiryBadge = (expiresAt: string) => {
    const days = getDaysUntilExpiry(expiresAt);
    if (days < 0) return { text: 'Expired', color: 'var(--color-error)', bg: 'var(--color-error)', opacity: 0.15 };
    if (days <= 7) return { text: `${days}d left`, color: 'var(--color-error)', bg: 'var(--color-error)', opacity: 0.15 };
    if (days <= 30) return { text: `${days}d left`, color: 'var(--color-warning)', bg: 'var(--color-warning)', opacity: 0.15 };
    return { text: new Date(expiresAt).toLocaleDateString(), color: Colors.medGray, bg: 'transparent' };
  };

  // Analytics calculations
  const conversionRate = codes.length > 0 ? Math.round((redeemedCodes.length / codes.length) * 100) : 0;
  const avgDaysToRedeem = (() => {
    const redeemed = codes.filter(c => c.redeemed_at && c.created_at);
    if (redeemed.length === 0) return 0;
    const totalDays = redeemed.reduce((sum: number, c: any) => {
      return sum + (new Date(c.redeemed_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(totalDays / redeemed.length);
  })();
  const expiringSoon = activeCodes.filter(c => c.expires_at && getDaysUntilExpiry(c.expires_at) <= 30 && getDaysUntilExpiry(c.expires_at) >= 0);
  const tierBreakdown = {
    home: codes.filter(c => c.tier === 'home').length,
    pro: codes.filter(c => c.tier === 'pro').length,
    pro_plus: codes.filter(c => c.tier === 'pro_plus').length,
  };
  const tierRedeemed = {
    home: codes.filter(c => c.tier === 'home' && c.redeemed_by).length,
    pro: codes.filter(c => c.tier === 'pro' && c.redeemed_by).length,
    pro_plus: codes.filter(c => c.tier === 'pro_plus' && c.redeemed_by).length,
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
        <button className={`tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
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
                    <div style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px', background: 'var(--color-copper-muted, #FFF3E0)', opacity: 0.4 }}>
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

                      {/* Sale Prep Status */}
                      {c.home?.sale_prep_active && (
                        <div style={{ marginTop: 16, borderTop: `1px solid var(--color-border)`, paddingTop: 16 }}>
                          <div className="flex items-center gap-sm mb-sm">
                            <span style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--color-warning)', opacity: 0.15, color: 'var(--color-warning)', fontSize: 11, fontWeight: 600 }}>SALE PREP</span>
                            <p style={{ fontWeight: 600, fontSize: 14 }}>Preparing Home for Sale</p>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                              { key: 'declutter', label: 'Declutter' },
                              { key: 'deep_clean', label: 'Deep Clean' },
                              { key: 'repairs', label: 'Repairs' },
                              { key: 'staging', label: 'Staging' },
                              { key: 'photos', label: 'Photos' },
                              { key: 'listing', label: 'Listing' },
                            ].map(step => {
                              const done = c.home?.sale_prep_checklist?.[step.key];
                              return (
                                <span key={step.key} style={{
                                  padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                                  background: done ? `${Colors.success}20` : Colors.lightGray,
                                  color: done ? Colors.success : Colors.medGray,
                                }}>
                                  {done ? '✓ ' : ''}{step.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Client Notes */}
                      <div style={{ marginTop: 16, borderTop: `1px solid var(--color-border)`, paddingTop: 16 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Notes</p>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          <input
                            type="text"
                            className="form-input"
                            style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                            placeholder="Add a note about this client..."
                            value={expandedClient === c.id ? newNote : ''}
                            onChange={e => setNewNote(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newNote.trim()) handleAddNote(c.id); }}
                          />
                          <select
                            className="form-select"
                            style={{ width: 110, padding: '6px 8px', fontSize: 12 }}
                            value={noteCategory}
                            onChange={e => setNoteCategory(e.target.value)}
                          >
                            <option value="general">General</option>
                            <option value="sale_prep">Sale Prep</option>
                            <option value="follow_up">Follow Up</option>
                            <option value="property">Property</option>
                            <option value="closing">Closing</option>
                          </select>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={savingNote || !newNote.trim()}
                            onClick={() => handleAddNote(c.id)}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {savingNote ? '...' : 'Add'}
                          </button>
                        </div>
                        {(clientNotes[c.id] || []).length === 0 ? (
                          <p className="text-xs text-gray" style={{ fontStyle: 'italic' }}>No notes yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                            {(clientNotes[c.id] || []).map((note: any) => (
                              <div key={note.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px', background: 'var(--color-background)', borderRadius: 6, fontSize: 13 }}>
                                <span style={{ padding: '1px 6px', borderRadius: 4, background: 'var(--color-copper-muted, #FFF3E0)', color: 'var(--color-copper)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', flexShrink: 0, marginTop: 2 }}>{note.category}</span>
                                <span style={{ flex: 1, color: Colors.charcoal }}>{note.note}</span>
                                <span className="text-xs text-gray" style={{ flexShrink: 0 }}>{new Date(note.created_at).toLocaleDateString()}</span>
                                <button className="btn btn-ghost" style={{ padding: 0, fontSize: 12, color: Colors.error, lineHeight: 1 }} onClick={() => handleDeleteNote(c.id, note.id)}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
                  backgroundColor: setupStep >= s ? Colors.copper : 'var(--color-background)',
                  color: setupStep >= s ? '#fff' : 'var(--color-text-secondary)',
                }}>
                  {setupStep > s ? '✓' : s}
                </div>
                {s < 3 && <div style={{ width: 40, height: 2, backgroundColor: setupStep > s ? Colors.copper : 'var(--color-background)' }} />}
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
              <div style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'var(--color-success)', opacity: 0.15, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
                ✓
              </div>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Invite Ready!</h2>
              <p className="text-gray" style={{ marginBottom: 24 }}>
                Share this code with {clientForm.name}. When they sign up and redeem it, their home will be pre-configured and they'll be connected to you as their agent.
              </p>

              <div style={{
                backgroundColor: 'var(--color-copper-muted, #FFF3E0)',
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

              <div style={{ backgroundColor: 'var(--color-sage)', opacity: 0.15, borderRadius: 8, padding: 16, marginBottom: 24, textAlign: 'left' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="mb-lg">
            <div className="card stat-card">
              <div className="stat-value" style={{ color: Colors.copper }}>{activeCodes.length}</div>
              <div className="stat-label">Available Codes</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: Colors.success }}>{redeemedCodes.length}</div>
              <div className="stat-label">Redeemed Codes</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: expiringSoon.length > 0 ? 'var(--color-error)' : Colors.medGray }}>{expiringSoon.length}</div>
              <div className="stat-label">Expiring Soon (30d)</div>
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
                        <td><code style={{ background: 'var(--color-copper-muted, #FFF3E0)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{c.code}</code></td>
                        <td><span className="badge badge-copper">{c.tier}</span></td>
                        <td className="text-sm">{c.client_name || '—'}</td>
                        <td>{c.duration_months} months</td>
                        <td>{c.expires_at ? (() => { const badge = getExpiryBadge(c.expires_at); return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, color: badge.color, background: badge.bg }}>{badge.text}</span>; })() : '—'}</td>
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

      // ═══ Analytics Tab ═══
      tab === 'analytics' ? (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Code Performance</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="mb-lg">
            <div className="card stat-card">
              <div className="stat-value" style={{ color: Colors.copper }}>{codes.length}</div>
              <div className="stat-label">Total Codes</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: Colors.success }}>{conversionRate}%</div>
              <div className="stat-label">Conversion Rate</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: Colors.sage }}>{avgDaysToRedeem}</div>
              <div className="stat-label">Avg Days to Redeem</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: expiringSoon.length > 0 ? 'var(--color-error)' : Colors.medGray }}>{expiringSoon.length}</div>
              <div className="stat-label">Expiring Soon</div>
            </div>
          </div>

          {/* Tier Breakdown */}
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Tier Breakdown</h2>
          <div className="card mb-lg" style={{ padding: 20 }}>
            {Object.entries(tierBreakdown).map(([tier, total]) => {
              const redeemed = tierRedeemed[tier as keyof typeof tierRedeemed] || 0;
              const pct = total > 0 ? Math.round((redeemed / total) * 100) : 0;
              const tierLabel = tier === 'pro_plus' ? 'Pro+' : tier.charAt(0).toUpperCase() + tier.slice(1);
              return (
                <div key={tier} style={{ marginBottom: tier !== 'pro_plus' ? 16 : 0 }}>
                  <div className="flex items-center justify-between mb-xs">
                    <span className="fw-600 text-sm">{tierLabel}</span>
                    <span className="text-sm text-gray">{redeemed} / {total} redeemed ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: Colors.lightGray, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: tier === 'home' ? Colors.copper : tier === 'pro' ? Colors.sage : Colors.charcoal, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Client Subscription Mix */}
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Client Subscription Mix</h2>
          <div className="card mb-lg" style={{ padding: 20 }}>
            {clients.length === 0 ? (
              <p className="text-sm text-gray">No clients yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {['free', 'home', 'pro', 'pro_plus'].map(tier => {
                  const count = clients.filter(c => (c.subscription_tier || 'free') === tier).length;
                  const tierLabel = tier === 'pro_plus' ? 'Pro+' : tier === 'free' ? 'Free' : tier.charAt(0).toUpperCase() + tier.slice(1);
                  return (
                    <div key={tier} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: tier === 'free' ? Colors.medGray : tier === 'home' ? Colors.copper : tier === 'pro' ? Colors.sage : Colors.charcoal }}>{count}</div>
                      <div className="text-xs text-gray">{tierLabel}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expiring Codes Detail */}
          {expiringSoon.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--color-error)' }}>Codes Expiring Within 30 Days</h2>
              <div className="card table-container mb-lg">
                <table>
                  <thead><tr><th>Code</th><th>Tier</th><th>Client</th><th>Expires</th></tr></thead>
                  <tbody>
                    {expiringSoon.map(c => {
                      const badge = getExpiryBadge(c.expires_at);
                      return (
                        <tr key={c.id}>
                          <td><code style={{ background: 'var(--color-copper-muted, #FFF3E0)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{c.code}</code></td>
                          <td><span className="badge badge-copper">{c.tier}</span></td>
                          <td className="text-sm">{c.client_name || '—'}</td>
                          <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, color: badge.color, background: badge.bg, opacity: badge.opacity || 1 }}>{badge.text}</span></td>
                        </tr>
                      );
                    })}
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
                    borderLeft: `3px solid ${n.read ? 'var(--color-background)' : Colors.copper}`,
                    opacity: n.read ? 0.7 : 1,
                    background: n.read ? undefined : `var(--color-copper-muted, #FFF3E0)`,
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
