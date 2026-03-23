import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { redeemGiftCode, insertProInterest } from '@/services/supabase';
import { PLANS, isProAvailableInArea } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';

export default function Subscription() {
  const navigate = useNavigate();
  const { user, home, setUser, setAgent } = useStore();
  const [giftCode, setGiftCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [waitlistZip, setWaitlistZip] = useState(home?.zip_code || '');
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState('');
  const tier = user?.subscription_tier || 'free';

  const proAvailable = isProAvailableInArea(home?.state, home?.zip_code);

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

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim() || !waitlistZip.trim()) return;
    setSubmittingWaitlist(true);
    try {
      await insertProInterest({
        email: waitlistEmail,
        zip_code: waitlistZip,
        user_id: user?.id || null,
        state: home?.state || null,
      });
      setWaitlistMessage('Thanks! We will notify you when Pro services are available in your area.');
      setWaitlistEmail('');
      setWaitlistZip('');
      setTimeout(() => setWaitlistMessage(''), 5000);
    } catch (e: any) {
      setWaitlistMessage(e.message || 'Failed to join waitlist');
    } finally {
      setSubmittingWaitlist(false);
    }
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
        {PLANS.map(plan => {
          const isInquiry = (plan as any).inquireForPricing === true;
          return (
          <div key={plan.id} className="card" style={tier === plan.value ? { border: `2px solid ${Colors.copper}` } : {}}>
            <div className="flex items-center justify-between mb-md">
              <div>
                <p style={{ fontSize: 16, fontWeight: 700 }}>{plan.name}</p>
                {isInquiry ? (
                  <p style={{ fontSize: 16, fontWeight: 600, color: Colors.copper }}>Inquire for Pricing</p>
                ) : (
                  <p style={{ fontSize: 22, fontWeight: 700, color: Colors.copper }}>${plan.price}<span className="text-sm text-gray">{plan.period}</span></p>
                )}
              </div>
              {tier === plan.value && <span className="badge badge-copper">Current</span>}
              {isInquiry && tier !== plan.value && <span className="badge" style={{ background: Colors.copperMuted, color: Colors.copper }}>Concierge</span>}
            </div>
            {isInquiry && tier !== plan.value && (
              <p style={{ fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
                Full property concierge — we manage every system in your home so you don't have to think about it.
              </p>
            )}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-sm" style={{ padding: '6px 0', fontSize: 14 }}>
                  <span style={{ color: Colors.copper }}>&#10003;</span> {f}
                </li>
              ))}
            </ul>
            {tier !== plan.value && !isInquiry && (
              <button className="btn btn-primary btn-full mt-md" onClick={() => alert('Payment integration required. Use a gift code to upgrade, or configure Stripe/RevenueCat.')}>
                {(plan.price || 0) > (PLANS.find(p => p.value === tier)?.price || 0) ? 'Upgrade' : 'Change Plan'}
              </button>
            )}
            {tier !== plan.value && isInquiry && (
              <button className="btn btn-secondary btn-full mt-md" onClick={() => alert('Interested in our full property concierge service? Contact us at support@canopyhome.app and we\'ll build a custom plan for your home.')}>
                Contact Us for Pricing
              </button>
            )}
          </div>
          );
        })}
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

      {/* Pro Interest Waitlist - Show if not in service area */}
      {!proAvailable && (
        <div className="card" style={{ background: Colors.copperMuted }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: Colors.copperDark, marginBottom: 8 }}>Join the Pro Waitlist</h3>
          <p className="text-sm text-gray mb-md">Pro services aren't available in your area yet, but they're coming soon! Join the waitlist to be notified when professional maintenance visits become available.</p>

          {waitlistMessage && <div style={{ padding: '10px 16px', borderRadius: 8, background: waitlistMessage.includes('Thanks') ? '#4CAF5020' : '#E5393520', color: waitlistMessage.includes('Thanks') ? '#2E7D32' : '#C62828', fontSize: 14, marginBottom: 12 }}>{waitlistMessage}</div>}

          <form onSubmit={handleWaitlistSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                className="form-input"
                type="email"
                value={waitlistEmail}
                onChange={e => setWaitlistEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label>ZIP Code</label>
              <input
                className="form-input"
                type="text"
                value={waitlistZip}
                onChange={e => setWaitlistZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="12345"
                maxLength={5}
                required
              />
            </div>
            <button
              className="btn btn-primary btn-full"
              type="submit"
              disabled={submittingWaitlist || !waitlistEmail.trim() || !waitlistZip.trim()}
            >
              {submittingWaitlist ? 'Joining...' : 'Join Waitlist'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
