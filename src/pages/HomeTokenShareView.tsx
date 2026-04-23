import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import HomeTokenShare from '@/components/HomeTokenShare';
import { getTransferByToken, type HomeTransfer as HomeTransferType } from '@/services/homeTransfer';
import { supabase } from '@/services/supabaseClient';

/**
 * Public view for a Home Token share link: /home-token/share/:transferToken
 * - Anyone with the link sees the QR, share URL, and verification history.
 * - If the current user's profile indicates they are a real estate agent, the attestation form is enabled.
 *   (Agents add credibility to the record; homeowners cannot self-attest.)
 */
export default function HomeTokenShareView() {
  const { transferToken } = useParams<{ transferToken: string }>();
  const navigate = useNavigate();
  const { user } = useStore();
  const [transfer, setTransfer] = useState<HomeTransferType | null>(null);
  const [home, setHome] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // P1-15 (2026-04-23): brokerage lives on the agents row, not profiles. Resolve it
  // up-front when the viewer is an agent so the attestation form pre-fills with the
  // agent's brokerage instead of the prior hardcoded `undefined`.
  const [agentBrokerage, setAgentBrokerage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const run = async () => {
      if (!transferToken) { setNotFound(true); setLoading(false); return; }
      try {
        const res = await getTransferByToken(transferToken);
        if (!res) { setNotFound(true); return; }
        setTransfer(res.transfer);
        setHome(res.home);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [transferToken]);

  useEffect(() => {
    // P1-15: only fetch brokerage for an authed agent with a linked agent_id.
    const isAgent = user?.role === 'agent';
    if (!isAgent || !user?.agent_id) {
      setAgentBrokerage(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('agents')
          .select('brokerage')
          .eq('id', user.agent_id)
          .maybeSingle();
        if (!cancelled) setAgentBrokerage(data?.brokerage || undefined);
      } catch {
        if (!cancelled) setAgentBrokerage(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.role, user?.agent_id]);

  if (loading) {
    return (
      <div className="page" style={{ maxWidth: 600, textAlign: 'center', padding: 40 }}>
        <div className="spinner"></div>
        <p style={{ marginTop: 16, color: Colors.medGray }}>Loading Home Token…</p>
      </div>
    );
  }

  if (notFound || !transfer || !home) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Home Token Not Found</h1></div>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: Colors.medGray, marginBottom: 16 }}>
            This Home Token link is no longer active. It may have expired, been cancelled, or already transferred.
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isAgent = user?.role === 'agent';
  const agentName = isAgent ? (user?.full_name || user?.email || undefined) : undefined;
  // P2 #44 (2026-04-23): Public QR viewers (anonymous) see city/state/ZIP only, not street.
  // Authenticated viewers (homeowner, linked agent, logged-in pro) still see full address.
  const canSeeStreet = !!user?.id;
  const cityState = [home.city, home.state, home.zip_code].filter(Boolean).join(', ');
  const primaryLine = canSeeStreet
    ? (home.address || 'Address pending')
    : (cityState || 'Location pending');
  const secondaryLine = canSeeStreet ? cityState : '';

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      {/* Home summary banner */}
      <div className="card" style={{
        padding: 16,
        marginBottom: 24,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        borderLeft: `4px solid ${Colors.sage}`,
      }}>
        {home.photo_url ? (
          <img src={home.photo_url} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: 8,
            background: Colors.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }} role="img" aria-label="Home">🏡</div>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, color: Colors.charcoal }}>{primaryLine}</p>
          {secondaryLine && (
            <p style={{ fontSize: 13, color: Colors.medGray }}>
              {secondaryLine}
            </p>
          )}
          {!canSeeStreet && (
            <p style={{ fontSize: 11, color: Colors.medGray, fontStyle: 'italic', marginTop: 2 }}>
              Full address shown to signed-in agents and homeowners
            </p>
          )}
          {home.record_completeness_score != null && (
            <p style={{ fontSize: 12, color: Colors.sageDark, marginTop: 4 }}>
              Record completeness: {home.record_completeness_score}%
              {home.agent_attested_at ? ' · Agent attested' : ''}
              {home.ownership_verified ? ' · Ownership verified' : ''}
            </p>
          )}
        </div>
      </div>

      <HomeTokenShare
        homeId={home.id}
        transferToken={transferToken!}
        isAgent={isAgent}
        agentName={agentName}
        agentBrokerage={agentBrokerage}
      />
    </div>
  );
}
