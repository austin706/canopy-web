import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import HomeTokenShare from '@/components/HomeTokenShare';
import { getTransferByToken, type HomeTransfer as HomeTransferType } from '@/services/homeTransfer';

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
  // agent brokerage is stored on the agent row, not the profile — fetching it would require another round-trip.
  const agentBrokerage: string | undefined = undefined;

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
          <p style={{ fontWeight: 600, color: Colors.charcoal }}>{home.address || 'Address pending'}</p>
          <p style={{ fontSize: 13, color: Colors.medGray }}>
            {[home.city, home.state, home.zip_code].filter(Boolean).join(', ')}
          </p>
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
