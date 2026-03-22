import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getAllGiftCodes } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, StatusColors } from '@/constants/theme';

export default function AgentPortal() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [tab, setTab] = useState<'clients' | 'codes'>('clients');
  const [clients, setClients] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Get agent record for this user
        const { data: agentData } = await supabase.from('agents').select('*').eq('email', user?.email).single();
        if (agentData) {
          // Get clients linked to this agent
          const { data: profileData } = await supabase.from('profiles').select('*').eq('agent_id', agentData.id);
          setClients(profileData || []);

          // Get gift codes for this agent
          const { data: codeData } = await supabase.from('gift_codes').select('*').eq('agent_id', agentData.id);
          setCodes(codeData || []);
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [user]);

  const activeCodes = codes.filter(c => !c.redeemed_by);
  const redeemedCodes = codes.filter(c => c.redeemed_by);

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
            <div className="card table-container">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Tier</th><th>Joined</th></tr></thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id}>
                      <td className="fw-600">{c.full_name || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td><span className="badge badge-copper">{c.subscription_tier || 'free'}</span></td>
                      <td className="text-sm text-gray">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
