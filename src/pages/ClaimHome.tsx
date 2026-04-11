import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getQRCodeByToken, claimQRCode } from '@/services/supabase';
import type { AgentHomeQRCode } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';

export default function ClaimHome() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useStore();
  const [qrCode, setQrCode] = useState<AgentHomeQRCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const loadQR = async () => {
      if (!token) { setError('Invalid QR code link.'); setLoading(false); return; }
      try {
        const qr = await getQRCodeByToken(token);
        if (!qr) { setError('This QR code was not found. It may have been revoked or the link is incorrect.'); }
        else if (qr.status === 'claimed') { setError('This home has already been claimed.'); }
        else if (qr.status === 'revoked') { setError('This QR code has been revoked by the agent.'); }
        else if (qr.status === 'expired' || (qr.expires_at && new Date(qr.expires_at) < new Date())) { setError('This QR code has expired. Please contact your agent for a new one.'); }
        else { setQrCode(qr); }
      } catch (e: any) {
        setError('Failed to load QR code: ' + (e.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };
    loadQR();
  }, [token]);

  const handleClaim = async () => {
    if (!qrCode || !user?.id) return;
    setClaiming(true);
    try {
      await claimQRCode(qrCode.qr_token, user.id);
      setClaimed(true);
    } catch (e: any) {
      setError('Failed to claim home: ' + (e.message || 'Unknown error'));
    } finally {
      setClaiming(false);
    }
  };

  const homeData = qrCode?.home_data as Record<string, any> | null;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error && !qrCode) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--color-error)', opacity: 0.15, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>!</div>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Unable to Claim Home</h1>
          <p style={{ color: Colors.medGray, marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Canopy Home</button>
        </div>
      </div>
    );
  }

  if (claimed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: Colors.success, opacity: 0.15, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Home Claimed!</h1>
          <p style={{ color: Colors.medGray, marginBottom: 8 }}>Your new home has been added to your Canopy account.</p>
          {homeData?.address && (
            <p style={{ fontWeight: 600, color: Colors.copper, marginBottom: 24 }}>{homeData.address}, {homeData.city}, {homeData.state} {homeData.zip_code}</p>
          )}
          <p style={{ color: Colors.medGray, fontSize: 14, marginBottom: 24 }}>All the home details have been pre-configured by your agent. Head to your dashboard to start managing your home.</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: Colors.copper, marginBottom: 4 }}>Canopy Home</h1>
          <p style={{ color: Colors.medGray }}>Claim your pre-built home</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {/* Home details preview */}
          {homeData && (
            <>
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>{homeData.address || 'Your New Home'}</h2>
              {homeData.city && <p className="text-sm text-gray" style={{ marginBottom: 16 }}>{homeData.city}, {homeData.state} {homeData.zip_code}</p>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {homeData.year_built && (
                  <div><p className="text-xs text-gray">Year Built</p><p className="fw-600 text-sm">{homeData.year_built}</p></div>
                )}
                {homeData.square_footage && (
                  <div><p className="text-xs text-gray">Size</p><p className="fw-600 text-sm">{Number(homeData.square_footage).toLocaleString()} sqft</p></div>
                )}
                {homeData.bedrooms && (
                  <div><p className="text-xs text-gray">Layout</p><p className="fw-600 text-sm">{homeData.bedrooms}bd / {homeData.bathrooms}ba</p></div>
                )}
                {homeData.stories && (
                  <div><p className="text-xs text-gray">Stories</p><p className="fw-600 text-sm">{homeData.stories}</p></div>
                )}
                {homeData.garage_spaces > 0 && (
                  <div><p className="text-xs text-gray">Garage</p><p className="fw-600 text-sm">{homeData.garage_spaces}-car</p></div>
                )}
                {homeData.roof_type && (
                  <div><p className="text-xs text-gray">Roof</p><p className="fw-600 text-sm">{String(homeData.roof_type).replace(/_/g, ' ')}</p></div>
                )}
              </div>

              {(homeData.has_pool || homeData.has_deck || homeData.has_sprinkler_system || homeData.has_fireplace) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                  {homeData.has_pool && <span className="badge badge-copper">Pool</span>}
                  {homeData.has_deck && <span className="badge badge-copper">Deck</span>}
                  {homeData.has_sprinkler_system && <span className="badge badge-copper">Sprinklers</span>}
                  {homeData.has_fireplace && <span className="badge badge-copper">Fireplace</span>}
                </div>
              )}
            </>
          )}

          {qrCode?.buyer_name && (
            <div style={{ padding: '10px 14px', background: Colors.copperMuted, borderRadius: 8, marginBottom: 16 }}>
              <p className="text-sm">Prepared for <strong>{qrCode.buyer_name}</strong> by your Canopy agent</p>
            </div>
          )}

          {error && <p style={{ color: 'var(--color-error)', fontSize: 14, marginBottom: 16 }}>{error}</p>}

          {!user ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: Colors.medGray, marginBottom: 16, fontSize: 14 }}>Sign in or create an account to claim this home.</p>
              <div className="flex gap-sm">
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/signup?redirect=/claim/${token}`)}>Sign Up</button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate(`/login?redirect=/claim/${token}`)}>Log In</button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: Colors.medGray, marginBottom: 16, fontSize: 14 }}>
                Signed in as <strong>{user.email}</strong>. This home will be added to your account.
              </p>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={claiming}
                onClick={handleClaim}
              >
                {claiming ? 'Claiming...' : 'Claim This Home'}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: Colors.medGray }}>
          Powered by Canopy Home &middot; <a href="/terms" style={{ color: Colors.copper }}>Terms</a> &middot; <a href="/privacy" style={{ color: Colors.copper }}>Privacy</a>
        </p>
      </div>
    </div>
  );
}
