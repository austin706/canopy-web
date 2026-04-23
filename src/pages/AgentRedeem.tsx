import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, redeemGiftCode } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

interface AgentInfo {
  id: string;
  name: string;
  brokerage: string;
  photo_url: string | null;
  logo_url: string | null;
  accent_color: string;
}

export default function AgentRedeem() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useStore();
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redeem form
  const [giftCode, setGiftCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [redeemError, setRedeemError] = useState('');

  useEffect(() => {
    const loadAgent = async () => {
      if (!slug) { setError('Invalid link.'); setLoading(false); return; }
      try {
        const { data, error: fetchErr } = await supabase
          .from('agents')
          .select('id, name, brokerage, photo_url, logo_url, accent_color')
          .eq('slug', slug)
          .single();
        if (fetchErr || !data) { setError('Agent not found. The link may be incorrect.'); }
        else { setAgent(data); }
      } catch {
        setError('Failed to load agent information.');
      } finally {
        setLoading(false);
      }
    };
    loadAgent();
  }, [slug]);

  const handleRedeem = async () => {
    if (!giftCode.trim() || !user?.id) return;
    setRedeeming(true);
    setRedeemError('');
    try {
      // P2 #50 (2026-04-23): Cross-agent redemption guard — ensure the gift code
      // was issued by the same agent whose branded URL the user landed on. Stops
      // a code issued by agent A from being redeemed on agent B's /a/<slug> page
      // (would otherwise leak attribution + assign the wrong connected agent).
      if (agent?.id) {
        const { data: gc, error: gcErr } = await supabase
          .from('gift_codes')
          .select('id, agent_id, redeemed_by, expires_at')
          .eq('code', giftCode.trim().toUpperCase())
          .maybeSingle();
        if (gcErr) throw gcErr;
        if (!gc) {
          setRedeemError('Invalid code.');
          setRedeeming(false);
          return;
        }
        if (gc.agent_id && gc.agent_id !== agent.id) {
          setRedeemError('This code was issued by a different agent. Please use the link from the agent who gave you this code.');
          setRedeeming(false);
          return;
        }
      }
      await redeemGiftCode(giftCode.trim(), user.id);
      setRedeemed(true);
    } catch (e: any) {
      setRedeemError(e.message || 'Invalid or expired code.');
    } finally {
      setRedeeming(false);
    }
  };

  const accentColor = agent?.accent_color || Colors.copper;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: `var(--color-error)`, opacity: 0.15, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>!</div>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Link Not Found</h1>
          <p style={{ color: Colors.medGray, marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Canopy Home</button>
        </div>
      </div>
    );
  }

  if (redeemed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: `${Colors.success}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Welcome to Canopy!</h1>
          <p style={{ color: Colors.medGray, marginBottom: 8 }}>Your code has been redeemed and your home is set up.</p>
          {agent && <p style={{ color: Colors.medGray, fontSize: 14, marginBottom: 24 }}>{agent.name} from {agent.brokerage} is your connected agent.</p>}
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', padding: 24 }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* Agent branding */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {agent?.logo_url && (
            <img
              src={agent.logo_url}
              alt={`${agent.brokerage} logo`}
              style={{ maxHeight: 48, maxWidth: 200, objectFit: 'contain', marginBottom: 20 }}
            />
          )}
          {agent?.photo_url ? (
            <img
              src={agent.photo_url}
              alt={agent.name}
              style={{ width: 80, height: 80, borderRadius: 40, objectFit: 'cover', border: `3px solid ${accentColor}`, marginBottom: 16 }}
            />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: 40, background: accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: Colors.white, fontSize: 28, fontWeight: 700, margin: '0 auto 16px',
            }}>
              {agent?.name?.charAt(0) || '?'}
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{agent?.name}</h1>
          <p style={{ color: Colors.medGray, fontSize: 15 }}>{agent?.brokerage}</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 8, color: accentColor }}>Canopy Home</h2>
            <p className="text-sm text-gray">Enter the gift code from your agent to activate your home and subscription.</p>
          </div>

          {!user ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: Colors.medGray, marginBottom: 16, fontSize: 14 }}>
                Create an account or sign in first, then enter your gift code.
              </p>
              <div className="flex gap-sm">
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/signup?redirect=/a/${slug}`)}>Sign Up</button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate(`/login?redirect=/a/${slug}`)}>Log In</button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: Colors.medGray, marginBottom: 16, fontSize: 14 }}>
                Signed in as <strong>{user.email}</strong>
              </p>

              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Gift Code</label>
                <input
                  className="form-input"
                  value={giftCode}
                  onChange={e => setGiftCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  style={{ fontWeight: 600, letterSpacing: 2, textAlign: 'center', fontSize: 18 }}
                  onKeyDown={e => { if (e.key === 'Enter' && giftCode.trim()) handleRedeem(); }}
                />
              </div>

              {redeemError && <p style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 12 }}>{redeemError}</p>}

              <button
                className="btn btn-primary"
                style={{ width: '100%', background: accentColor }}
                disabled={redeeming || !giftCode.trim()}
                onClick={handleRedeem}
              >
                {redeeming ? 'Redeeming...' : 'Redeem Code'}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: Colors.medGray }}>
          Powered by Canopy Home &middot; <a href="/terms" style={{ color: accentColor }}>Terms</a> &middot; <a href="/privacy" style={{ color: accentColor }}>Privacy</a>
        </p>
      </div>
    </div>
  );
}
