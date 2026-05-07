import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Colors, FontSize } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import HomeTokenShare from '@/components/HomeTokenShare';
import { getTransferByToken, type HomeTransfer as HomeTransferType } from '@/services/homeTransfer';
import { supabase } from '@/services/supabaseClient';

// 2026-05-02: Buyer-facing callout for the certified inspection. Pulls
// the PDF certificate URL lazily so we don't widen the home select
// across every Home Token view.
function CertifiedInspectionCallout({
  homeId, inspectedAt, inspectionCount, inspectionId,
}: { homeId: string; inspectedAt: string; inspectionCount?: number; inspectionId?: string }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!inspectionId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('home_inspections')
        .select('pdf_certificate_url')
        .eq('id', inspectionId)
        .maybeSingle();
      if (!cancelled && data?.pdf_certificate_url) setPdfUrl(data.pdf_certificate_url);
    })();
    return () => { cancelled = true; };
  }, [inspectionId, homeId]);

  return (
    <div className="card" style={{
      padding: 14,
      marginBottom: 16,
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      background: `${Colors.copper}10`,
      borderLeft: `4px solid ${Colors.copper}`,
    }}>
      <div aria-hidden="true" style={{ fontSize: FontSize.xxl, lineHeight: 1, flexShrink: 0 }}>🛡️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: FontSize.sm, fontWeight: 700, color: Colors.charcoal, margin: 0 }}>
          Canopy Maintenance Inspection on file
        </p>
        <p style={{ fontSize: 12 /* allow-lint */, color: Colors.medGray, margin: '2px 0 0' }}>
          Last inspected {new Date(inspectedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          {inspectionCount && inspectionCount > 1 ? ` · ${inspectionCount} inspections total` : ''}
        </p>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: Colors.copper, fontWeight: 600, marginTop: 4, display: 'inline-block' }} // allow-lint
          >
            View certificate (PDF) →
          </a>
        )}
      </div>
    </div>
  );
}

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

  // 2026-05-02 (STRATEGIC_TOP #10): "wow" pass for the public share view.
  // The audience here is a buyer or agent encountering Canopy for the
  // first time. We need them to feel: (a) this house has been cared for,
  // (b) the record is verified by Canopy (not self-reported), (c) they
  // could have this for their own home in two taps.
  const trustBadges: Array<{ label: string; tone: string }> = [];
  if (home.last_certified_inspection_at) trustBadges.push({ label: 'Canopy Maintenance Inspection', tone: Colors.copper });
  if (home.agent_attested_at) trustBadges.push({ label: 'Agent attested', tone: Colors.sage });
  if (home.ownership_verified) trustBadges.push({ label: 'Ownership verified', tone: Colors.sage });

  const completeness = home.record_completeness_score ?? 0;
  const completenessTone = completeness >= 80 ? Colors.success : completeness >= 60 ? Colors.sage : completeness >= 40 ? Colors.warning : Colors.medGray;

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      {/* 2026-05-02 hero — "this home has been cared for" narrative */}
      <div style={{
        background: `linear-gradient(135deg, ${Colors.cream} 0%, ${Colors.copper}12 100%)`,
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        border: `1px solid ${Colors.lightGray}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span aria-hidden="true" style={{ fontSize: FontSize.lg }}>🏡</span>
          <span style={{ fontSize: FontSize.xs, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.copper }}>
            Canopy Home Token
          </span>
        </div>
        <h1 style={{ fontSize: 26 /* allow-lint */, fontWeight: 700, color: Colors.charcoal, margin: '0 0 6px', lineHeight: 1.2 }}>
          {primaryLine}
        </h1>
        {secondaryLine && (
          <p style={{ fontSize: 14 /* allow-lint */, color: Colors.medGray, margin: '0 0 16px' }}>{secondaryLine}</p>
        )}
        {/* Completeness bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 12 /* allow-lint */, fontWeight: 600, color: Colors.charcoal }}>Record completeness</span>
            <span style={{ fontSize: FontSize.sm, fontWeight: 700, color: completenessTone }}>{completeness}%</span>
          </div>
          <div style={{
            height: 8, borderRadius: 4, background: Colors.lightGray, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${completeness}%`, borderRadius: 4,
              background: completenessTone, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
        {/* Trust badges */}
        {trustBadges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {trustBadges.map(b => (
              <span key={b.label} style={{
                fontSize: FontSize.xs, fontWeight: 600,
                padding: '4px 10px', borderRadius: 999,
                background: `${b.tone}18`, color: b.tone,
              }}>
                ✓ {b.label}
              </span>
            ))}
          </div>
        )}
        {!canSeeStreet && (
          <p style={{ fontSize: FontSize.xs, color: Colors.medGray, fontStyle: 'italic', marginTop: 12 }}>
            Full address visible only to signed-in agents and the homeowner.
          </p>
        )}
      </div>

      {/* Home photo card (kept) */}
      <div className="card" style={{
        padding: 16,
        marginBottom: 16,
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
            fontSize: FontSize.xxl,
          } as React.CSSProperties} role="img" aria-label="Home">🏡</div>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: FontSize.sm, color: Colors.charcoal, margin: 0, fontWeight: 600, lineHeight: 1.3 }}>
            What you&apos;re looking at
          </p>
          <p style={{ fontSize: FontSize.xs, color: Colors.medGray, margin: '4px 0 0', lineHeight: 1.5 }}>
            A tamper-evident maintenance record. Every entry (visit, repair, replacement, warranty, inspection) is timestamped, photo-backed where applicable, and verifiable through Canopy. The homeowner cannot edit history retroactively.
          </p>
        </div>
      </div>

      {/* Certified inspection callout */}
      {home.last_certified_inspection_at && (
        <CertifiedInspectionCallout
          homeId={home.id}
          inspectedAt={home.last_certified_inspection_at}
          inspectionCount={home.certified_inspection_count}
          inspectionId={home.last_certified_inspection_id}
        />
      )}

      <HomeTokenShare
        homeId={home.id}
        transferToken={transferToken!}
        isAgent={isAgent}
        agentName={agentName}
        agentBrokerage={agentBrokerage}
      />

      {/* 2026-05-06: buyer-side conversion wedge. Only shown to anonymous
          viewers — the existing homeowner and signed-in agent shouldn't
          be re-pitched on Canopy. Copy reframed to land on buyers
          specifically: they're looking at this BECAUSE they're considering
          buying or repping a home. The pitch is: "you'll wish your next
          home had this — start one for the home you're in now." */}
      {!user && (
        <div style={{
          marginTop: 28,
          padding: 24,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${Colors.charcoal} 0%, #1a1a1a 100%)`,
          color: '#fff',
          textAlign: 'center',
          border: `1px solid ${Colors.copper}40`,
        }}>
          <p style={{ fontSize: 12 /* allow-lint */, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.copper, margin: 0 }}>
            Like what you&apos;re seeing?
          </p>
          <h2 style={{ fontSize: 22 /* allow-lint */, fontWeight: 700, color: '#fff', margin: '10px 0', lineHeight: 1.25 }}>
            Start a Home Token for the home you&apos;re in now.
          </h2>
          <p style={{ fontSize: 14 /* allow-lint */, color: '#cdcdcd', margin: '0 0 18px', lineHeight: 1.55, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            Free forever for your first home. Layer in scheduled Pro visits and the Annual Maintenance Inspection only when you want the credibility on listing day.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/signup')}
            style={{
              background: Colors.copper, color: '#fff', border: 'none',
              padding: '13px 26px', borderRadius: 10, fontSize: 14, fontWeight: 700, // allow-lint
              cursor: 'pointer',
            }}
          >
            Start my free Home Token, 2 minutes
          </button>
          <p style={{ fontSize: FontSize.xs, color: '#9b9b9b', margin: '14px 0 0' }}>
            No credit card · cancel anytime · <a href="/login" style={{ color: Colors.copper, textDecoration: 'none', fontWeight: 600 }}>sign in if you have an account</a>
          </p>
        </div>
      )}

      {/* 2026-05-06: Verified-by-Canopy footer note for trust on the public
          buyer-facing view. Anonymous viewers see this as reassurance that
          the record they're looking at is real, not a homeowner-built spreadsheet. */}
      <p style={{
        fontSize: 11, // allow-lint
        color: Colors.medGray, textAlign: 'center', margin: '20px 0 8px',
        fontStyle: 'italic',
      }}>
        🛡️ Verified through Canopy · canopyhome.app
      </p>
    </div>
  );
}
