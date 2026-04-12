import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { showToast } from '@/components/Toast';

/**
 * AgentPurchaseCodes — Agents gift subscriptions to clients via Stripe wholesale pricing.
 *
 * Flow: Pick tier → pick duration → choose delivery (code or direct to user email) → pay via Stripe.
 * Wholesale pricing: Home $5/mo (retail $6.99), Pro $130/mo (retail $149).
 * No free code generation — everything goes through Stripe.
 */

interface GiftCode {
  id: string;
  code: string;
  tier: string;
  duration_months: number;
  client_name?: string;
  client_email?: string;
  redeemed_by?: string;
  redeemed_at?: string;
  expires_at?: string;
  created_at: string;
}

const WHOLESALE_RATES = {
  home: { monthly: 5, retail: 6.99, label: 'Home', color: Colors.copper },
  pro: { monthly: 130, retail: 149, label: 'Pro', color: Colors.sage },
};

const DURATION_PRESETS = [1, 3, 6, 12];

export default function AgentPurchaseCodes() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [codes, setCodes] = useState<GiftCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'gift' | 'codes'>('gift');
  const [filter, setFilter] = useState<'all' | 'available' | 'redeemed'>('all');

  // Role gate: agents and admins can access this page
  useEffect(() => {
    if (user && !['agent', 'admin'].includes(user.role || '')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Gift form state
  const [tier, setTier] = useState<'home' | 'pro'>('home');
  const [months, setMonths] = useState(12);
  const [customMonths, setCustomMonths] = useState('');
  const [delivery, setDelivery] = useState<'code' | 'direct'>('code');
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadCodes();
  }, [user?.id]);

  const loadCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('gift_codes')
        .select('*')
        .eq('agent_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCodes(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const effectiveMonths = customMonths ? parseInt(customMonths) || 0 : months;
  const rate = WHOLESALE_RATES[tier];
  const totalPrice = effectiveMonths * rate.monthly;
  const retailPrice = effectiveMonths * rate.retail;
  const savings = retailPrice - totalPrice;

  const handlePurchase = async () => {
    if (effectiveMonths < 1) return;
    if (delivery === 'direct' && !clientEmail.trim()) return;
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-agent-checkout', {
        body: {
          agent_id: user!.id,
          tier,
          duration_months: effectiveMonths,
          delivery,
          client_email: delivery === 'direct' ? clientEmail.trim().toLowerCase() : null,
          client_name: clientName.trim() || null,
          amount_cents: Math.round(totalPrice * 100),
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e: any) {
      showToast({ message: 'Unable to start checkout: ' + (e.message || 'Please try again.') });
    } finally {
      setPurchasing(false);
    }
  };

  const availableCodes = codes.filter(c => !c.redeemed_by);
  const redeemedCodes = codes.filter(c => !!c.redeemed_by);
  const displayCodes = filter === 'available' ? availableCodes : filter === 'redeemed' ? redeemedCodes : codes;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast({ message: 'Code copied to clipboard!' });
  };

  const isPreset = !customMonths && DURATION_PRESETS.includes(months);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1>Gift a Subscription</h1>
        <p className="subtitle">Purchase subscriptions for your clients at wholesale agent pricing</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: `2px solid ${Colors.lightGray}` }}>
        {[
          { key: 'gift' as const, label: 'Gift Subscription' },
          { key: 'codes' as const, label: `My Codes (${codes.length})` },
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

      {tab === 'gift' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          {/* Left: Configuration */}
          <div>
            {/* Step 1: Tier */}
            <div className="card mb-md">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: Colors.charcoal }}>1. Choose Plan</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['home', 'pro'] as const).map(t => {
                  const r = WHOLESALE_RATES[t];
                  const selected = tier === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTier(t)}
                      style={{
                        padding: '16px 14px', borderRadius: 10, border: `2px solid ${selected ? r.color : Colors.lightGray}`,
                        background: selected ? r.color + '10' : 'white', cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 700, color: r.color, marginBottom: 4 }}>{r.label}</div>
                      <div style={{ fontSize: 13, color: Colors.medGray }}>
                        <span style={{ fontWeight: 600, color: Colors.charcoal }}>${r.monthly}/mo</span>
                        <span style={{ textDecoration: 'line-through', marginLeft: 6 }}>${r.retail}/mo</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Duration */}
            <div className="card mb-md">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: Colors.charcoal }}>2. Duration</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {DURATION_PRESETS.map(d => (
                  <button
                    key={d}
                    onClick={() => { setMonths(d); setCustomMonths(''); }}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${months === d && !customMonths ? rate.color : Colors.lightGray}`,
                      background: months === d && !customMonths ? rate.color + '10' : 'white',
                      color: months === d && !customMonths ? rate.color : Colors.medGray,
                      fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {d === 12 ? '1 year' : `${d} mo`}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: Colors.medGray }}>or custom:</span>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max="60"
                  value={customMonths}
                  onChange={e => setCustomMonths(e.target.value)}
                  placeholder="# months"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 13, color: Colors.medGray }}>months</span>
              </div>
            </div>

            {/* Step 3: Delivery */}
            <div className="card mb-md">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: Colors.charcoal }}>3. Delivery</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: delivery === 'direct' ? 12 : 0 }}>
                <button
                  onClick={() => setDelivery('code')}
                  style={{
                    padding: '14px', borderRadius: 10, border: `2px solid ${delivery === 'code' ? rate.color : Colors.lightGray}`,
                    background: delivery === 'code' ? rate.color + '10' : 'white', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: delivery === 'code' ? rate.color : Colors.charcoal, marginBottom: 2 }}>Generate Code</div>
                  <div style={{ fontSize: 12, color: Colors.medGray }}>Get a code to share at closing, via text, etc.</div>
                </button>
                <button
                  onClick={() => setDelivery('direct')}
                  style={{
                    padding: '14px', borderRadius: 10, border: `2px solid ${delivery === 'direct' ? rate.color : Colors.lightGray}`,
                    background: delivery === 'direct' ? rate.color + '10' : 'white', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: delivery === 'direct' ? rate.color : Colors.charcoal, marginBottom: 2 }}>Gift Directly</div>
                  <div style={{ fontSize: 12, color: Colors.medGray }}>Activate on an existing user by email</div>
                </button>
              </div>
              {delivery === 'direct' && (
                <div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 13 }}>Client Email *</label>
                    <input className="form-input" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@email.com" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 13 }}>Client Name (optional)</label>
                    <input className="form-input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                </div>
              )}
              {delivery === 'code' && (
                <div style={{ marginTop: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 13 }}>Client Name (optional — shown when they redeem)</label>
                    <input className="form-input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Price summary */}
          <div className="card" style={{ position: 'sticky', top: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: Colors.charcoal }}>Order Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: Colors.medGray }}>{rate.label} Plan</span>
              <span style={{ fontSize: 13 }}>${rate.monthly}/mo</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: Colors.medGray }}>Duration</span>
              <span style={{ fontSize: 13 }}>{effectiveMonths} month{effectiveMonths !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: Colors.medGray }}>Delivery</span>
              <span style={{ fontSize: 13 }}>{delivery === 'code' ? 'Gift Code' : 'Direct Activation'}</span>
            </div>
            <div style={{ borderTop: `1px solid ${Colors.lightGray}`, margin: '12px 0', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: Colors.medGray, textDecoration: 'line-through' }}>Retail</span>
                <span style={{ fontSize: 13, color: Colors.medGray, textDecoration: 'line-through' }}>${retailPrice.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: Colors.success, fontWeight: 600 }}>Agent Savings</span>
                <span style={{ fontSize: 13, color: Colors.success, fontWeight: 600 }}>-${savings.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: rate.color }}>${totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 16, background: rate.color }}
              onClick={handlePurchase}
              disabled={purchasing || effectiveMonths < 1 || (delivery === 'direct' && !clientEmail.trim())}
            >
              {purchasing ? 'Opening Checkout...' : `Pay $${totalPrice.toFixed(2)}`}
            </button>
            <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 8, textAlign: 'center' }}>
              Secure checkout via Stripe
            </p>
          </div>
        </div>
      )}

      {tab === 'codes' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: Colors.copper }}>{codes.length}</div>
              <div style={{ fontSize: 12, color: Colors.medGray }}>Total</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: Colors.sage }}>{availableCodes.length}</div>
              <div style={{ fontSize: 12, color: Colors.medGray }}>Available</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: Colors.success }}>{redeemedCodes.length}</div>
              <div style={{ fontSize: 12, color: Colors.medGray }}>Redeemed</div>
            </div>
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['all', 'available', 'redeemed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                style={{ textTransform: 'capitalize' }}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center"><div className="spinner" /></div>
          ) : displayCodes.length === 0 ? (
            <div className="card text-center" style={{ padding: 48 }}>
              <p className="text-gray">No codes yet. Gift a subscription to get started.</p>
              <button className="btn btn-primary mt-md" onClick={() => setTab('gift')}>Gift Subscription</button>
            </div>
          ) : (
            <div className="card table-container">
              <table>
                <thead>
                  <tr><th>Code</th><th>Tier</th><th>Duration</th><th>Client</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {displayCodes.map(c => (
                    <tr key={c.id}>
                      <td><code style={{ fontSize: 13, fontWeight: 600, color: Colors.copper }}>{c.code}</code></td>
                      <td>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                          background: c.tier === 'pro' ? Colors.sageMuted : Colors.copperMuted,
                          color: c.tier === 'pro' ? Colors.sage : Colors.copper,
                          textTransform: 'uppercase',
                        }}>
                          {c.tier}
                        </span>
                      </td>
                      <td>{c.duration_months} mo</td>
                      <td>{c.client_name || c.client_email || '—'}</td>
                      <td>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                          background: c.redeemed_by ? Colors.success + '20' : Colors.warning + '20',
                          color: c.redeemed_by ? Colors.success : Colors.warning,
                        }}>
                          {c.redeemed_by ? 'Redeemed' : 'Available'}
                        </span>
                      </td>
                      <td>
                        {!c.redeemed_by && (
                          <button className="btn btn-secondary btn-sm" onClick={() => copyCode(c.code)}>Copy</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
