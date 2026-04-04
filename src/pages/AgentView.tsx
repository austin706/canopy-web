import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { supabase, sendNotification, sendDirectEmailNotification } from '@/services/supabase';
import { linkAgent } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { AgentAvatar } from '@/components/AgentAvatar';

/**
 * AgentView — User-facing page to view their linked agent, search for an agent, or manage link requests.
 * - If linked: shows agent info + option to unlink
 * - If not linked: search by name or email, auto-confirm linking (no approval needed from agent)
 * - Shows pending link requests from agents for user to approve/reject
 */

export default function AgentView() {
  const { agent, user, setAgent, setUser } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loadedRequests, setLoadedRequests] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  // Load pending link requests from agents
  const loadPendingRequests = async () => {
    if (!user?.id || loadedRequests) return;
    try {
      const { data } = await supabase
        .from('agent_link_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingRequests(data || []);
    } catch (e) { console.error(e); }
    finally { setLoadedRequests(true); }
  };

  // Search agents by name or email
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSearchError('');
    try {
      const q = searchQuery.trim().toLowerCase();
      // Search by email first (exact match)
      const { data: byEmail } = await supabase
        .from('agents')
        .select('*')
        .ilike('email', q);
      // Then search by name (partial match)
      const { data: byName } = await supabase
        .from('agents')
        .select('*')
        .ilike('name', `%${q}%`);

      // Deduplicate
      const combined = [...(byEmail || []), ...(byName || [])];
      const unique = combined.filter((a, i) => combined.findIndex(x => x.id === a.id) === i);

      if (unique.length === 0) {
        setSearchError('No agents found. Try a different name or email.');
      } else {
        setSearchResults(unique);
      }
    } catch (e: any) {
      setSearchError(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Auto-confirm link (user-initiated)
  const handleLink = async (agentData: any) => {
    if (!user?.id) return;
    setLinking(true);
    try {
      await linkAgent(user.id, agentData.id);
      setAgent(agentData);
      if (user) setUser({ ...user, agent_id: agentData.id });
      setSearchResults([]);
      setSearchQuery('');
    } catch (e: any) {
      alert('Failed to link agent: ' + (e.message || 'Please try again.'));
    } finally {
      setLinking(false);
    }
  };

  // Unlink current agent
  const handleUnlink = async () => {
    if (!user?.id || !confirm('Unlink your agent? You can search for a new one afterwards.')) return;
    setUnlinking(true);
    try {
      await supabase.from('profiles').update({ agent_id: null }).eq('id', user.id);
      setAgent(null);
      if (user) setUser({ ...user, agent_id: null });
    } catch (e: any) {
      alert('Failed to unlink: ' + e.message);
    } finally {
      setUnlinking(false);
    }
  };

  // Approve agent link request
  const handleApproveRequest = async (request: any) => {
    if (!user?.id) return;
    setProcessingRequest(request.id);
    try {
      // Update request status
      await supabase.from('agent_link_requests').update({ status: 'approved' }).eq('id', request.id);
      // Link the agent
      await linkAgent(user.id, request.agent_id);
      // Load agent data
      const { data: agentData } = await supabase.from('agents').select('*').eq('id', request.agent_id).single();
      if (agentData) {
        setAgent(agentData);
        if (user) setUser({ ...user, agent_id: request.agent_id });
      }
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));

      // Notify the agent that the link was approved
      // Resolve agent's profile ID for in-app notification
      const userName = user.full_name || user.email || 'A homeowner';
      let agentProfileId: string | null = null;
      if (agentData?.email) {
        const { data: agentProfile } = await supabase.from('profiles').select('id').eq('email', agentData.email).single();
        agentProfileId = agentProfile?.id || null;
      }
      // Save to DB — process-queue cron handles email + push delivery server-side
      if (agentData?.email) {
        sendDirectEmailNotification({
          recipient_email: agentData.email,
          user_id: agentProfileId || undefined,
          title: 'Agent Link Approved',
          body: `${userName} has approved your link request. You can now view their home details in your Agent Portal.`,
          subject: 'Your agent link request was approved',
          category: 'agent',
          action_url: '/agent-portal',
          action_label: 'View Agent Portal',
        }).catch(() => {});
      }
    } catch (e: any) {
      alert('Failed to approve: ' + e.message);
    } finally {
      setProcessingRequest(null);
    }
  };

  // Reject agent link request
  const handleRejectRequest = async (request: any) => {
    if (!user?.id) return;
    setProcessingRequest(request.id);
    try {
      await supabase.from('agent_link_requests').update({ status: 'rejected' }).eq('id', request.id);
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));

      // Notify the agent that the link was declined
      const { data: agentData } = await supabase.from('agents').select('user_id, email, name').eq('id', request.agent_id).single();
      if (agentData?.email) {
        let agentProfileId: string | null = null;
        const { data: agentProfile } = await supabase.from('profiles').select('id').eq('email', agentData.email).single();
        agentProfileId = agentProfile?.id || null;
        sendDirectEmailNotification({
          recipient_email: agentData.email,
          user_id: agentProfileId || undefined,
          title: 'Agent Link Declined',
          body: `A homeowner has declined your link request. They may not be ready to link with an agent at this time.`,
          category: 'agent',
          action_url: '/agent-portal',
        }).catch(() => {});
      } else if (agentData?.user_id) {
        // No email on file — at least save in-app
        sendNotification({
          user_id: agentData.user_id,
          title: 'Agent Link Declined',
          body: `A homeowner has declined your link request. They may not be ready to link with an agent at this time.`,
          category: 'agent',
          action_url: '/agent-portal',
        }).catch(() => {});
      }
    } catch (e: any) {
      alert('Failed to reject: ' + e.message);
    } finally {
      setProcessingRequest(null);
    }
  };

  // Load requests on first render if no agent
  if (!agent && !loadedRequests) {
    loadPendingRequests();
  }

  // ── Linked Agent View ──
  if (agent) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Your Agent</h1></div>
        <div className="card">
          <div className="flex items-center gap-lg mb-lg">
            <AgentAvatar
              name={agent.name}
              photoUrl={agent.photo_url}
              size="lg"
              accentColor={agent.accent_color || Colors.copper}
            />
            <div>
              <h2 style={{ fontSize: 20 }}>{agent.name}</h2>
              <p className="text-sm text-gray">{agent.brokerage}</p>
            </div>
          </div>
          <div className="flex-col gap-md">
            <div className="flex items-center gap-md" style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: Colors.copper }}>@</span>
              <div><p className="text-xs text-gray">Email</p><p style={{ fontSize: 14, fontWeight: 500 }}>{agent.email}</p></div>
            </div>
            <div className="flex items-center gap-md" style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: Colors.copper }}>Tel</span>
              <div><p className="text-xs text-gray">Phone</p><p style={{ fontSize: 14, fontWeight: 500 }}>{agent.phone}</p></div>
            </div>
          </div>
          <div className="flex gap-sm mt-lg">
            <a href={`mailto:${agent.email}`} className="btn btn-primary" style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}>Email Agent</a>
            <a href={`tel:${agent.phone}`} className="btn btn-sage" style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}>Call Agent</a>
          </div>
          <button
            className="btn btn-ghost btn-full mt-md"
            style={{ color: Colors.error, fontSize: 13 }}
            onClick={handleUnlink}
            disabled={unlinking}
          >
            {unlinking ? 'Unlinking...' : 'Unlink Agent'}
          </button>
        </div>
      </div>
    );
  }

  // ── No Agent — Search & Link ──
  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header"><h1>Your Agent</h1></div>

      {/* Pending Requests from Agents */}
      {pendingRequests.length > 0 && (
        <div className="card mb-lg" style={{ border: `2px solid ${Colors.copper}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Agent Link Requests</h3>
          {pendingRequests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>Agent wants to link with you</p>
                <p style={{ fontSize: 12, color: Colors.medGray }}>{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleApproveRequest(r)}
                  disabled={processingRequest === r.id}
                >
                  Approve
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: Colors.error }}
                  onClick={() => handleRejectRequest(r)}
                  disabled={processingRequest === r.id}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Agent State */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: Colors.copper + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 20, color: Colors.copper }}>AG</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>No Agent Connected</h2>
          <p className="text-gray" style={{ fontSize: 14 }}>Search for your real estate agent by name or email to connect with them.</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
            placeholder="Agent name or email..."
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? '...' : 'Search'}
          </button>
        </div>
        {searchError && <p style={{ color: Colors.error, fontSize: 13, marginTop: 8 }}>{searchError}</p>}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Results</h3>
          {searchResults.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
              <AgentAvatar name={a.name} photoUrl={a.photo_url} size="sm" accentColor={a.accent_color || Colors.copper} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</p>
                <p style={{ fontSize: 12, color: Colors.medGray }}>{a.brokerage || a.email}</p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleLink(a)}
                disabled={linking}
              >
                {linking ? '...' : 'Link'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 20, background: Colors.cream, border: 'none' }}>
        <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>
          You can also connect with an agent by redeeming a gift code they provide.
          Go to <strong>Subscription</strong> to enter a gift code.
        </p>
      </div>
    </div>
  );
}
