import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { Colors, FontSize } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { useTabState } from '@/utils/useTabState';
import logger from '@/utils/logger';

const PURCHASE_CODE_TABS = ['gift', 'codes'] as const;
type PurchaseCodeTab = typeof PURCHASE_CODE_TABS[number];

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
  // P3 #77 (2026-04-23) — URL-sync tab so back-button + deep-link work.
  const [tab, setTab] = useTabState<PurchaseCodeTab>(PURCHASE_CODE_TABS, 'gift');
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

  // 2026-05-02 (STRATEGIC_TOP #6): batch quantity for closing-gift purchases.
  // Quantity > 1 forces delivery='code' since direct activation needs a unique
  // email per gift; the batch flow generates N codes for the agent to mail out.
  const [quantity, setQuantity] = useState(1);

  // 2026-05-02: agent identity for the co-branded gift card preview.
  // Brokerage lives on agents.brokerage (not profiles), so we resolve it
  // up-front and cache.
  const [agentName, setAgentName] = useState<string>('');
  const [agentBrokerage, setAgentBrokerage] = useState<string>('');
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const fullName = (user as { full_name?: string }).full_name || '';
        if (!cancelled) setAgentName(fullName);
        const agentId = (user as { agent_id?: string }).agent_id;
        if (!agentId) return;
        const { data } = await supabase
          .from('agents')
          .select('brokerage')
          .eq('id', agentId)
          .maybeSingle();
        if (!cancelled && data?.brokerage) setAgentBrokerage(data.brokerage);
      } catch {/* non-blocking */}
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

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
    } catch (e) { logger.error(e); }
    finally { setLoading(false); }
  };

  const effectiveMonths = customMonths ? parseInt(customMonths) || 0 : months;
  const effectiveQuantity = Math.max(1, Math.min(50, quantity || 1));
  const rate = WHOLESALE_RATES[tier];
  const perCodePrice = effectiveMonths * rate.monthly;
  const totalPrice = perCodePrice * effectiveQuantity;
  const retailPrice = effectiveMonths * rate.retail * effectiveQuantity;
  const savings = retailPrice - totalPrice;
  const isBatch = effectiveQuantity > 1;

  const handlePurchase = async () => {
    if (effectiveMonths < 1) return;
    if (delivery === 'direct' && !clientEmail.trim()) return;
    if (isBatch && delivery === 'direct') {
      showToast({ message: 'Batch orders generate codes. Switch delivery to Gift Code.' });
      return;
    }
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
          // 2026-05-02: closing-gift batch + co-brand metadata so the
          // checkout edge fn can stamp every generated code with the
          // agent's name + brokerage for the recipient email/preview.
          quantity: effectiveQuantity,
          agent_name: agentName || undefined,
          agent_brokerage: agentBrokerage || undefined,
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
              <h3 style={{ fontSize: FontSize.md, fontWeight: 600, marginBottom: 12, color: Colors.charcoal }}>1. Choose Plan</h3>
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
                      <div style={{ fontSize: FontSize.sm, color: Colors.medGray }}>
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
              <h3 style={{ fontSize: FontSize.md, fontWeight: 600, marginBottom: 12, color: Colors.charcoal }}>2. Duration</h3>
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
                <span style={{ fontSize: FontSize.sm, color: Colors.medGray }}>or custom:</span>
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
                <span style={{ fontSize: FontSize.sm, color: Colors.medGray }}>months</span>
              </div>
            </div>

            {/* Step 3: Delivery */}
            <div className="card mb-md">
              <h3 style={{ fontSize: FontSize.md, fontWeight: 600, marginBottom: 12, color: Colors.charcoal }}>3. Delivery</h3>
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
                    <label style={{ fontSize: FontSize.sm }}>Client Email <span aria-hidden="true">*</span></label>
                    <input className="form-input" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@email.com" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: FontSize.sm }}>Client Name (optional)</label>
                    <input className="form-input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                </div>
              )}
              {delivery === 'code' && (
                <div style={{ marginTop: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: FontSize.sm }}>Client Name (optional, shown when they redeem)</label>
                    <input className="form-input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Price summary + co-branded preview */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 2026-05-02: Batch quantity selector — closing-gift use case */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: Colors.charcoal }}>
              Quantity
            </h3>
            <p style={{ fontSize: FontSize.xs, color: Colors.medGray, margin: '0 0 10px' }}>
              Bulk-buy codes for closings, referrals, or campaigns. Each code is unique.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1, 5, 10, 25].map(q => (
                <button
                  key={q}
                  onClick={() => setQuantity(q)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: FontSize.sm, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${quantity === q ? rate.color : Colors.lightGray}`,
                    background: quantity === q ? rate.color + '10' : 'white',
                    color: quantity === q ? rate.color : Colors.medGray,
                  }}
                >
                  {q}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={50}
                value={[1, 5, 10, 25].includes(quantity) ? '' : quantity}
                onChange={e => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                placeholder="Custom"
                className="form-input"
                style={{ width: 80, padding: '4px 8px', fontSize: FontSize.sm }}
              />
            </div>
            {isBatch && delivery === 'direct' && (
              <p style={{ fontSize: FontSize.xs, color: Colors.warning, marginTop: 8 }}>
                Batch orders deliver as gift codes. Pick "Gift Code" delivery above.
              </p>
            )}
          </div>

          {/* 2026-05-02: Co-branded gift preview — what the recipient sees */}
          <div className="card" style={{
            background: `linear-gradient(135deg, ${Colors.cream} 0%, ${rate.color}10 100%)`,
            border: `1px solid ${Colors.lightGray}`,
          }}>
            <p style={{
              fontSize: FontSize.xs, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              color: rate.color, margin: '0 0 8px',
            }}>
              Recipient preview
            </p>
            <div style={{
              padding: 16, background: 'white', borderRadius: 8, border: `1px solid ${Colors.lightGray}`,
            }}>
              <p style={{ fontSize: FontSize.xs, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: Colors.copper, margin: 0 }}>
                A closing gift from
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: Colors.charcoal, margin: '2px 0 0' }}>
                {agentName || 'Your Realtor'}
              </p>
              {agentBrokerage && (
                <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 10px' }}>
                  {agentBrokerage}
                </p>
              )}
              <div style={{
                marginTop: 10, padding: '12px 14px', borderRadius: 6,
                background: Colors.cream, border: `1px dashed ${rate.color}`,
              }}>
                <p style={{ fontSize: FontSize.sm, fontWeight: 600, color: Colors.charcoal, margin: 0 }}>
                  {clientName || 'Friend'}, welcome home. Here's a year of Canopy on me.
                </p>
                <p style={{ fontSize: FontSize.xs, color: Colors.medGray, margin: '6px 0 0' }}>
                  Canopy {rate.label} · {effectiveMonths} month{effectiveMonths !== 1 ? 's' : ''} · redeem at canopyhome.app
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: FontSize.md, fontWeight: 600, marginBottom: 16, color: Colors.charcoal }}>Order Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: FontSize.sm, color: Colors.medGray }}>{rate.label} Plan</span>
              <span style={{ fontSize: FontSize.sm }}>${rate.monthly}/mo</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: FontSize.sm, color: Colors.medGray }}>Duration</span>
              <span style={{ fontSize: FontSize.sm }}>{effectiveMonths} month{effectiveMonths !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: FontSize.sm, color: Colors.medGray }}>Quantity</span>
              <span style={{ fontSize: FontSize.sm }}>{effectiveQuantity}{isBatch ? ' codes' : ''}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: FontSize.sm, color: Colors.medGray }}>Delivery</span>
              <span style={{ fontSize: FontSize.sm }}>{delivery === 'code' ? 'Gift Code' : 'Direct Activation'}</span>
            </div>
            <div style={{ borderTop: `1px solid ${Colors.lightGray}`, margin: '12px 0', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: FontSize.sm, color: Colors.medGray, textDecoration: 'line-through' }}>Retail</span>
                <span style={{ fontSize: FontSize.sm, color: Colors.medGray, textDecoration: 'line-through' }}>${retailPrice.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: FontSize.sm, color: Colors.success, fontWeight: 600 }}>Agent Savings</span>
                <span style={{ fontSize: FontSize.sm, color: Colors.success, fontWeight: 600 }}>-${savings.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: FontSize.lg, fontWeight: 700, color: Colors.charcoal }}>Total</span>
                <span style={{ fontSize: FontSize.lg, fontWeight: 700, color: rate.color }}>${totalPrice.toFixed(2)}</span>
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
            <p style={{ fontSize: FontSize.xs, color: Colors.medGray, marginTop: 8, textAlign: 'center' }}>
              Secure checkout via Stripe
            </p>
          </div>
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
                      <td><code style={{ fontSize: FontSize.sm, fontWeight: 600, color: Colors.copper }}>{c.code}</code></td>
                      <td>
                        <span style={{
                          fontSize: FontSize.xs, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                          background: c.tier === 'pro' ? Colors.sageMuted : Colors.copperMuted,
                          color: c.tier === 'pro' ? Colors.sage : Colors.copper,
                          textTransform: 'uppercase',
                        }}>
                          {c.tier}
                        </span>
                      </td>
                      <td>{c.duration_months} mo</td>
                      <td>{c.client_name || c.client_email || '-'}</td>
                      <td>
                        <span style={{
                          fontSize: FontSize.xs, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
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
