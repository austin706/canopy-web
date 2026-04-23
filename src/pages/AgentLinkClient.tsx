import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { supabase, sendNotification } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { useTabState } from '@/utils/useTabState';
import logger from '@/utils/logger';

const LINK_CLIENT_TABS = ['search', 'pending', 'clients'] as const;
type LinkClientTab = typeof LINK_CLIENT_TABS[number];

/**
 * AgentLinkClient — Search existing users by email and request to link as their agent.
 * The user receives a notification to approve. Once approved, agent_id is set on their profile.
 * Also shows pending and approved link requests.
 */

interface LinkRequest {
  id: string;
  agent_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface LinkedClient {
  id: string;
  full_name: string;
  email: string;
  subscription_tier: string;
  created_at: string;
}

export default function AgentLinkClient() {
  const { user } = useStore();
  // P3 #77 (2026-04-23) — URL-sync tab so back-button + deep-link work.
  const [tab, setTab] = useTabState<LinkClientTab>(LINK_CLIENT_TABS, 'search');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<LinkRequest[]>([]);
  const [linkedClients, setLinkedClients] = useState<LinkedClient[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoadingRequests(true);
    try {
      // Load pending link requests
      const { data: requests } = await supabase
        .from('agent_link_requests')
        .select('*')
        .eq('agent_id', user!.id)
        .order('created_at', { ascending: false });
      setPendingRequests(requests || []);

      // Load currently linked clients
      const { data: clients } = await supabase
        .from('profiles')
        .select('id, full_name, email, subscription_tier, created_at')
        .eq('agent_id', user!.id)
        .order('full_name');
      setLinkedClients(clients || []);
    } catch (e) { logger.error(e); }
    finally { setLoadingRequests(false); }
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError('');
    setSent(false);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, subscription_tier, agent_id')
        .eq('email', searchEmail.trim().toLowerCase())
        .single();
      if (error || !data) {
        setSearchError('No user found with that email address.');
        return;
      }
      setSearchResult(data);
    } catch (e: any) {
      setSearchError(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSendLinkRequest = async () => {
    if (!searchResult || !user?.id) return;
    setSending(true);
    try {
      // Check if already linked
      if (searchResult.agent_id === user.id) {
        setSearchError('This user is already linked to you.');
        setSending(false);
        return;
      }

      // Check for existing pending request
      const { data: existing } = await supabase
        .from('agent_link_requests')
        .select('id')
        .eq('agent_id', user.id)
        .eq('user_id', searchResult.id)
        .eq('status', 'pending')
        .single();

      if (existing) {
        setSearchError('You already have a pending request for this user.');
        setSending(false);
        return;
      }

      // Create link request
      const { error: insertErr } = await supabase.from('agent_link_requests').insert({
        id: crypto.randomUUID(),
        agent_id: user.id,
        user_id: searchResult.id,
        user_email: searchResult.email,
        user_name: searchResult.full_name,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      if (insertErr) throw insertErr;

      // Send notification to user (in-app + email + push)
      await sendNotification({
        user_id: searchResult.id,
        title: 'Agent Link Request',
        body: `${user.full_name || 'An agent'} has requested to link with your account. Go to My Agent to approve or decline.`,
        category: 'agent',
        action_url: '/my-agent',
      });

      setSent(true);
      loadData(); // Refresh lists
    } catch (e: any) {
      setSearchError(e.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const pendingCount = pendingRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <h1>Link Client</h1>
        <p className="subtitle">Search for existing users and request to link as their agent</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: `2px solid ${Colors.lightGray}` }}>
        {[
          { key: 'search' as const, label: 'Search User' },
          { key: 'pending' as const, label: `Pending (${pendingCount})` },
          { key: 'clients' as const, label: `My Clients (${linkedClients.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14, color: tab === t.key ? Colors.copper : Colors.medGray,
              borderBottom: tab === t.key ? `2px solid ${Colors.copper}` : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search Tab */}
      {tab === 'search' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Search by Email</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                type="email"
                value={searchEmail}
                onChange={e => { setSearchEmail(e.target.value); setSearchError(''); setSent(false); setSearchResult(null); }}
                placeholder="client@email.com"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleSearch} disabled={searching || !searchEmail.trim()}>
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {searchError && <p style={{ color: Colors.error, fontSize: 13, marginTop: 8 }}>{searchError}</p>}
          </div>

          {/* Search Result */}
          {searchResult && (
            <div className="card">
              <div className="flex items-center gap-lg mb-md">
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: Colors.copperMuted, color: Colors.copper, fontWeight: 700, fontSize: 18,
                }}>
                  {searchResult.full_name?.charAt(0) || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{searchResult.full_name || 'Unknown'}</h3>
                  <p style={{ fontSize: 13, color: Colors.medGray }}>{searchResult.email}</p>
                </div>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase',
                  background: Colors.sageMuted, color: Colors.sage,
                }}>
                  {searchResult.subscription_tier || 'free'}
                </span>
              </div>

              {searchResult.agent_id && searchResult.agent_id !== user?.id && (
                <div style={{ background: Colors.warning + '15', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>
                  <p style={{ fontSize: 13, color: Colors.warning, fontWeight: 500, margin: 0 }}>
                    This user already has an agent linked. Your request will replace the existing link if approved.
                  </p>
                </div>
              )}

              {searchResult.agent_id === user?.id ? (
                <div style={{ background: Colors.success + '15', padding: '10px 14px', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, color: Colors.success, fontWeight: 500, margin: 0 }}>This user is already linked to you.</p>
                </div>
              ) : sent ? (
                <div style={{ background: Colors.success + '15', padding: '10px 14px', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, color: Colors.success, fontWeight: 500, margin: 0 }}>Link request sent! The user will receive a notification to approve.</p>
                </div>
              ) : (
                <button className="btn btn-primary btn-full" onClick={handleSendLinkRequest} disabled={sending}>
                  {sending ? 'Sending Request...' : 'Send Link Request'}
                </button>
              )}
            </div>
          )}

          <div className="card" style={{ marginTop: 20, background: Colors.cream, border: 'none' }}>
            <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>
              <strong>How linking works:</strong> Search for a user by their email, then send a link request.
              The user will receive a notification and can approve or decline. Once approved, you will appear as their
              agent and can view their home details.
            </p>
          </div>
        </div>
      )}

      {/* Pending Tab */}
      {tab === 'pending' && (
        <div>
          {loadingRequests ? (
            <div className="text-center"><div className="spinner" /></div>
          ) : pendingRequests.length === 0 ? (
            <div className="card text-center" style={{ padding: 48 }}>
              <p className="text-gray">No link requests yet.</p>
              <button className="btn btn-primary mt-md" onClick={() => setTab('search')}>Search for a Client</button>
            </div>
          ) : (
            <div className="card table-container">
              <table>
                <thead><tr><th>User</th><th>Email</th><th>Status</th><th>Requested</th></tr></thead>
                <tbody>
                  {pendingRequests.map(r => (
                    <tr key={r.id}>
                      <td className="fw-600">{r.user_name || '—'}</td>
                      <td>{r.user_email || '—'}</td>
                      <td>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                          background: r.status === 'approved' ? Colors.success + '20' : r.status === 'rejected' ? Colors.error + '20' : Colors.warning + '20',
                          color: r.status === 'approved' ? Colors.success : r.status === 'rejected' ? Colors.error : Colors.warning,
                          textTransform: 'capitalize',
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: Colors.medGray }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Clients Tab */}
      {tab === 'clients' && (
        <div>
          {loadingRequests ? (
            <div className="text-center"><div className="spinner" /></div>
          ) : linkedClients.length === 0 ? (
            <div className="card text-center" style={{ padding: 48 }}>
              <p className="text-gray">No linked clients yet. Share codes or send link requests to connect with clients.</p>
            </div>
          ) : (
            <div className="card table-container">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Joined</th></tr></thead>
                <tbody>
                  {linkedClients.map(c => (
                    <tr key={c.id}>
                      <td className="fw-600">{c.full_name || '—'}</td>
                      <td>{c.email}</td>
                      <td>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase',
                          background: Colors.sageMuted, color: Colors.sage,
                        }}>
                          {c.subscription_tier || 'free'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: Colors.medGray }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
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
