import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { redeemGiftCode } from '@/services/supabase';
import { PLANS } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';

export default function Subscription() {
  const navigate = useNavigate();
  const { user, setUser, setAgent } = useStore();
  const [giftCode, setGiftCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const tier = user?.subscription_tier || 'free';

  const handleRedeem = async () => {
    if (!giftCode.trim() || !user) return;
    setRedeeming(true);
    try {
      const r = await redeemGiftCode(giftCode, user.id);
      setUser({ ...user, subscription_tier: r.tier as any, subscription_expires_at: r.expiresAt, agent_id: r.agent?.id });
      if (r.agent) setAgent(r.agent);
      setMessage(`Upgraded to ${PLANS.find(p => p.value === r.tier)?.name}!`);
      setGiftCode('');
    } catch (e: any) { setMessage(e.message); }
    finally { setRedeeming(false); setTimeout(() => setMessage(''), 5000); }
  };

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate(-1)}>&larr; Back</button>
          <h1>Your Plan</h1>
        </div>
      </div>

      {message && <div style={{ padding: '10px 16px', borderRadius: 8, background: message.includes('Failed') || message.includes('Invalid') || message.includes('expired') || message.includes('redeemed') ? '#E5393520' : '#4CAF5020', color: message.includes('Failed') || message.includes('Invalid') || message.includes('expired') || message.includes('redeemed') ? '#C62828' : '#2E7D32', fontSize: 14, marginBottom: 16 }}>{message}</div>}

      {/* Current Plan */}
      <div className="card mb-lg" style={{ background: Colors.copperMuted }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs fw-600 text-copper">CURRENT PLAN</p>
            <p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>{PLANS.find(p => p.value === tier)?.name || 'Free'}</p>
            <p style={{ fontSize: 24, fontWeight: 700 }}>${PLANS.find(p => p.value === tier)?.price || 0}<span className="text-sm text-gray">{PLANS.find(p => p.value === tier)?.period}</span></p>
          </div>
          <div style={{ fontSize: 40, color: Colors.copper }}>&#10003;</div>
        </div>
      </div>

      {/* Plans Grid */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Available Plans</h2>
      <div className="grid-2 mb-lg">
        {PLANS.map(plan => (
          <div key={plan.id} className="card" style={tier === plan.value ? { border: `2px solid ${Colors.copper}` } : {}}>
            <div className="flex items-center justify-between mb-md">
              <div>
                <p style={{ fontSize: 16, fontWeight: 700 }}>{plan.name}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: Colors.copper }}>${plan.price}<span className="text-sm text-gray">{plan.period}</span></p>
              </div>
              {tier === plan.value && <span className="badge badge-copper">Current</span>}
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-sm" style={{ padding: '6px 0', fontSize: 14 }}>
                  <span style={{ color: Colors.copper }}>&#10003;</span> {f}
                </li>
              ))}
            </ul>
            {tier !== plan.value && (
              <button className="btn btn-primary btn-full mt-md" onClick={() => alert('Payment integration required. Use a gift code to upgrade, or configure Stripe/RevenueCat.')}>
                {plan.price > (PLANS.find(p => p.value === tier)?.price || 0) ? 'Upgrade' : 'Change Plan'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Gift Code */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Redeem Gift Code</h3>
        <p className="text-sm text-gray mb-md">Have a gift code from your real estate agent? Enter it below to unlock premium features.</p>
        <div className="flex gap-sm">
          <input className="form-input" value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())} placeholder="Enter gift code" style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleRedeem} disabled={redeeming || !giftCode.trim()}>
            {redeeming ? 'Redeeming...' : 'Redeem'}
          </button>
        </div>
      </div>
    </div>
  );
}
