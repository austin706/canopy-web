import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { redeemGiftCode, insertProInterest, supabase } from '@/services/supabase';
import { PLANS, loadServiceAreas, isProAvailableInArea } from '@/services/subscriptionGate';
import { enrollProSubscriber, findProviderForZip } from '@/services/proEnrollment';
import { requestConsultation } from '@/services/proPlus';
import { Colors } from '@/constants/theme';
import { CheckCircleIcon, CheckIcon } from '@/components/icons/Icons';
import ServiceAreaMap from '@/components/ServiceAreaMap';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Load Stripe.js from CDN (cached after first load)
let stripePromise: Promise<any> | null = null;
function loadStripe(): Promise<any> {
  if (stripePromise) return stripePromise;
  stripePromise = new Promise((resolve, reject) => {
    if ((window as any).Stripe) {
      resolve((window as any).Stripe(STRIPE_PUBLISHABLE_KEY));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => resolve((window as any).Stripe(STRIPE_PUBLISHABLE_KEY));
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });
  return stripePromise;
}

export default function Subscription() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, home, setUser, setAgent } = useStore();
  const [giftCode, setGiftCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [waitlistZip, setWaitlistZip] = useState(home?.zip_code || '');
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState('');
  const tier = user?.subscription_tier || 'free';

  // Plan change modal state
  const [planChangeModal, setPlanChangeModal] = useState<{
    visible: boolean;
    loading: boolean;
    confirming: boolean;
    preview: any | null;
    targetTier: string | null;
  }>({ visible: false, loading: false, confirming: false, preview: null, targetTier: null });

  const previewPlanChange = async (newTier: string) => {
    if (!user) return;
    setPlanChangeModal({ visible: true, loading: true, confirming: false, preview: null, targetTier: newTier });
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/update-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'preview', new_tier: newTier }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to preview plan change');
      // If requires_checkout, redirect to checkout flow instead
      if (data.requires_checkout) {
        setPlanChangeModal(prev => ({ ...prev, visible: false }));
        handleStripeCheckout(newTier);
        return;
      }
      setPlanChangeModal(prev => ({ ...prev, loading: false, preview: data }));
    } catch (e: any) {
      setPlanChangeModal(prev => ({ ...prev, visible: false }));
      setMessage(e.message || 'Failed to preview plan change');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const confirmPlanChange = async () => {
    if (!planChangeModal.targetTier || !user) return;
    setPlanChangeModal(prev => ({ ...prev, confirming: true }));
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/update-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'confirm', new_tier: planChangeModal.targetTier }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to change plan');
      // Update local state
      const { setUser } = useStore.getState();
      if (user) {
        setUser({ ...user, subscription_tier: data.new_tier });
      }
      setPlanChangeModal({ visible: false, loading: false, confirming: false, preview: null, targetTier: null });
      let successMsg = data.message || `Plan changed to ${data.new_name}!`;
      if (data.pro_services_note) successMsg += ' ' + data.pro_services_note;
      setMessage(successMsg);
      setTimeout(() => setMessage(''), 8000);
    } catch (e: any) {
      setPlanChangeModal(prev => ({ ...prev, confirming: false }));
      setMessage(e.message || 'Failed to change plan');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const closePlanChangeModal = () => {
    setPlanChangeModal({ visible: false, loading: false, confirming: false, preview: null, targetTier: null });
  };

  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<{ provider: { business_name: string } | null; visitCreated: boolean } | null>(null);
  const [requestingProPlus, setRequestingProPlus] = useState(false);
  const [proPlusMessage, setProPlusMessage] = useState('');
  const [notifyMeSubmitted, setNotifyMeSubmitted] = useState<Record<string, boolean>>({});
  const [notifyMeLoading, setNotifyMeLoading] = useState<string | null>(null);

  const handleNotifyMe = async (tierInterest: 'pro' | 'pro_plus') => {
    if (!user) return;
    setNotifyMeLoading(tierInterest);
    try {
      await insertProInterest({
        email: user.email,
        zip_code: home?.zip_code || null,
        user_id: user.id,
        state: home?.state || null,
        city: home?.city || null,
        full_name: user.full_name || null,
        tier_interest: tierInterest,
      });
      setNotifyMeSubmitted(prev => ({ ...prev, [tierInterest]: true }));
    } catch (e: any) {
      if (e.code === '23505' || e.message?.includes('duplicate')) {
        setNotifyMeSubmitted(prev => ({ ...prev, [tierInterest]: true }));
      } else {
        setMessage('Could not save your interest — please try again.');
        setTimeout(() => setMessage(''), 5000);
      }
    } finally {
      setNotifyMeLoading(null);
    }
  };

  // Handle Pro+ consultation request
  const handleProPlusRequest = async () => {
    if (!user || !home) {
      setProPlusMessage('Please complete your home profile before requesting Pro+.');
      setTimeout(() => setProPlusMessage(''), 5000);
      return;
    }
    setRequestingProPlus(true);
    try {
      // Find a provider for their zip
      const provider = home.zip_code ? await findProviderForZip(home.zip_code) : null;
      if (!provider) {
        setProPlusMessage('No Pro+ providers are available in your area yet. Join the waitlist to be notified!');
        setTimeout(() => setProPlusMessage(''), 5000);
        return;
      }
      await requestConsultation(home.id, provider.id);
      setProPlusMessage('Consultation requested! Your Canopy pro will reach out to schedule an in-home assessment. Check your notifications for updates.');
      setTimeout(() => setProPlusMessage(''), 10000);
    } catch (e: any) {
      if (e.message?.includes('duplicate') || e.code === '23505') {
        setProPlusMessage('You already have a Pro+ consultation request. Check your Pro+ page for status updates.');
      } else {
        setProPlusMessage(e.message || 'Failed to request consultation');
      }
      setTimeout(() => setProPlusMessage(''), 5000);
    } finally {
      setRequestingProPlus(false);
    }
  };

  // Handle Stripe redirect success/cancel
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      const plan = searchParams.get('plan');
      // Clean URL and replace history so back button doesn't go to Stripe
      window.history.replaceState({}, '', '/subscription');
      setMessage(`Successfully upgraded to ${PLANS.find(p => p.value === plan)?.name || plan}! Your subscription is now active.`);
      // Refresh user profile to pick up new tier
      if (user?.id) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
          if (data) {
            setUser({ ...user, ...data });
            // Auto-enroll if upgrading to a Pro tier
            if ((plan === 'pro' || plan === 'pro_plus') && tier !== 'pro' && tier !== 'pro_plus') {
              handleProEnrollment(user.id);
            }
          }
        });
      }
    } else if (searchParams.get('canceled') === 'true') {
      window.history.replaceState({}, '', '/subscription');
      setMessage('Checkout was canceled. No charges were made.');
    }
  }, [searchParams]);

  // Pro enrollment: auto-assign provider, create first visit, notify
  const handleProEnrollment = async (userId: string) => {
    setEnrolling(true);
    try {
      const result = await enrollProSubscriber(userId);
      setEnrollmentResult(result);
    } catch (err) {
      console.warn('Pro enrollment automation failed (non-blocking):', err);
    } finally {
      setEnrolling(false);
    }
  };

  // Embedded checkout state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const checkoutInstanceRef = useRef<any>(null);

  const closeCheckoutModal = useCallback(() => {
    if (checkoutInstanceRef.current) {
      checkoutInstanceRef.current.destroy();
      checkoutInstanceRef.current = null;
    }
    setShowCheckoutModal(false);
    setCheckoutPlan(null);
    setCheckoutLoading(null);
  }, []);

  const handleStripeCheckout = async (plan: string) => {
    if (!user || !SUPABASE_URL) {
      setMessage('Payment system is not configured. Use a gift code to upgrade.');
      return;
    }

    // Fall back to redirect mode if no publishable key configured
    if (!STRIPE_PUBLISHABLE_KEY) {
      setCheckoutLoading(plan);
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            tier: plan,
            success_url: `${window.location.origin}/subscription?success=true&plan=${plan}`,
            cancel_url: `${window.location.origin}/subscription?canceled=true`,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to create checkout session');
        window.location.replace(data.url);
      } catch (e: any) {
        setMessage(e.message || 'Checkout failed');
        setTimeout(() => setMessage(''), 5000);
      } finally {
        setCheckoutLoading(null);
      }
      return;
    }

    // Embedded checkout mode
    setCheckoutLoading(plan);
    setCheckoutPlan(plan);
    setShowCheckoutModal(true);

    try {
      const [stripe, authSession] = await Promise.all([
        loadStripe(),
        supabase.auth.getSession(),
      ]);
      const token = authSession.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          tier: plan,
          ui_mode: 'embedded',
          return_url: `${window.location.origin}/subscription?success=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create checkout session');

      // Mount embedded checkout
      const checkout = await stripe.initEmbeddedCheckout({
        clientSecret: data.client_secret,
      });
      checkoutInstanceRef.current = checkout;

      // Wait for the modal DOM to be ready, then mount
      requestAnimationFrame(() => {
        if (checkoutRef.current) {
          checkout.mount(checkoutRef.current);
        }
      });

      setCheckoutLoading(null);
    } catch (e: any) {
      closeCheckoutModal();
      setMessage(e.message || 'Checkout failed');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const [proAvailable, setProAvailable] = useState(true);

  useEffect(() => {
    loadServiceAreas().then(() => {
      setProAvailable(isProAvailableInArea(home?.state, home?.zip_code));
    });
  }, [home?.state, home?.zip_code]);

  const handleRedeem = async () => {
    if (!giftCode.trim() || !user) return;
    setRedeeming(true);
    try {
      const r = await redeemGiftCode(giftCode, user.id);
      setUser({ ...user, subscription_tier: r.tier as any, subscription_expires_at: r.expiresAt, agent_id: r.agent?.id });
      if (r.agent) setAgent(r.agent);
      setMessage(`Upgraded to ${PLANS.find(p => p.value === r.tier)?.name}!`);
      setGiftCode('');
      // Auto-enroll if upgrading to Pro via gift code
      if ((r.tier === 'pro' || r.tier === 'pro_plus') && tier !== 'pro' && tier !== 'pro_plus') {
        handleProEnrollment(user.id);
      }
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
        city: home?.city || null,
        full_name: user?.full_name || null,
        tier_interest: 'pro',
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

      {/* Pro Enrollment Progress */}
      {enrolling && (
        <div className="card mb-lg" style={{ background: Colors.sageMuted, padding: '20px 24px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 600, fontSize: 16, color: Colors.sage, margin: '0 0 4px' }}>Setting up your Pro experience...</p>
          <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>Finding your local Canopy pro and scheduling your first visit.</p>
        </div>
      )}

      {/* Pro Enrollment Result */}
      {enrollmentResult && !enrolling && (
        <div className="card mb-lg" style={{ background: Colors.sageMuted, padding: '20px 24px' }}>
          <p style={{ fontWeight: 700, fontSize: 18, color: Colors.sage, margin: '0 0 8px' }}>Welcome to Canopy {tier === 'pro_plus' ? 'Pro+' : 'Pro'}!</p>
          {enrollmentResult.provider ? (
            <>
              <p style={{ fontSize: 14, color: Colors.charcoal, margin: '0 0 4px' }}>
                Your Canopy pro is <strong>{enrollmentResult.provider.business_name}</strong>.
              </p>
              {enrollmentResult.visitCreated && (
                <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 12px' }}>
                  Your first bimonthly home visit has been proposed. Head to Pro Services to review the date and add notes for your technician.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, color: Colors.charcoal, margin: '0 0 12px' }}>
              We're finding the perfect Canopy pro for your area. You'll be notified as soon as your provider is assigned and your first visit is scheduled.
            </p>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/pro-services')}>
            Go to Pro Services
          </button>
        </div>
      )}

      {/* Current Plan */}
      <div className="card mb-lg" style={{ background: Colors.copperMuted }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs fw-600 text-copper">CURRENT PLAN</p>
            <p style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>{PLANS.find(p => p.value === tier)?.name || 'Free'}</p>
            <p style={{ fontSize: 24, fontWeight: 700 }}>{(PLANS.find(p => p.value === tier) as any)?.inquireForPricing ? 'Concierge Plan' : `$${PLANS.find(p => p.value === tier)?.price || 0}`}<span className="text-sm text-gray">{(PLANS.find(p => p.value === tier) as any)?.inquireForPricing ? '' : PLANS.find(p => p.value === tier)?.period}</span></p>
          </div>
          <CheckCircleIcon size={40} color={Colors.copper} />
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
                  <CheckIcon size={14} color={Colors.copper} /> {f}
                </li>
              ))}
            </ul>
            {tier !== plan.value && plan.value !== 'free' && (
              !proAvailable && (plan.value === 'pro' || plan.value === 'pro_plus') ? (
                <div style={{
                  marginTop: 12,
                  padding: '10px 16px',
                  background: Colors.cream,
                  borderRadius: 8,
                  textAlign: 'center',
                  border: `1px dashed ${Colors.silver}`,
                }}>
                  {notifyMeSubmitted[plan.value] ? (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 600, color: Colors.sage, margin: 0 }}>
                        <CheckIcon size={12} color={Colors.sage} /> You're on the list!
                      </p>
                      <p style={{ fontSize: 12, color: Colors.medGray, margin: '4px 0 0' }}>
                        We'll notify you when {plan.name} is available in your area.
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 600, color: Colors.medGray, margin: 0 }}>
                        Not yet available in your area
                      </p>
                      <button
                        className="btn btn-secondary btn-sm mt-sm"
                        onClick={() => handleNotifyMe(plan.value as 'pro' | 'pro_plus')}
                        disabled={notifyMeLoading === plan.value}
                        style={{ fontSize: 12 }}
                      >
                        {notifyMeLoading === plan.value ? 'Saving...' : 'Notify Me When Available'}
                      </button>
                    </>
                  )}
                </div>
              ) : isInquiry ? (
                <>
                  <button
                    className="btn btn-secondary btn-full mt-md"
                    onClick={handleProPlusRequest}
                    disabled={requestingProPlus}
                  >
                    {requestingProPlus ? 'Requesting...' : 'Request Consultation'}
                  </button>
                  {proPlusMessage && (
                    <div style={{
                      marginTop: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.4,
                      background: proPlusMessage.includes('Failed') || proPlusMessage.includes('No Pro+') || proPlusMessage.includes('complete your')
                        ? '#E5393520' : '#4CAF5020',
                      color: proPlusMessage.includes('Failed') || proPlusMessage.includes('No Pro+') || proPlusMessage.includes('complete your')
                        ? '#C62828' : '#2E7D32',
                    }}>
                      {proPlusMessage}
                    </div>
                  )}
                </>
              ) : (
                <button
                  className="btn btn-primary btn-full mt-md"
                  onClick={() => tier === 'free' ? handleStripeCheckout(plan.value) : previewPlanChange(plan.value)}
                  disabled={checkoutLoading === plan.value || planChangeModal.loading}
                >
                  {checkoutLoading === plan.value || (planChangeModal.loading && planChangeModal.targetTier === plan.value)
                    ? 'Loading...'
                    : (plan.price || 0) > (PLANS.find(p => p.value === tier)?.price || 0)
                      ? 'Upgrade'
                      : 'Change Plan'}
                </button>
              )
            )}
            {tier !== plan.value && plan.value === 'free' && tier !== 'free' && (
              <button
                className="btn btn-ghost btn-full mt-md"
                onClick={() => previewPlanChange('free')}
                disabled={planChangeModal.loading}
              >
                {planChangeModal.loading && planChangeModal.targetTier === 'free' ? 'Loading...' : 'Downgrade to Free'}
              </button>
            )}
          </div>
          );
        })}
      </div>

      {/* Service Area Map */}
      <div className="card mb-lg">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Pro Service Areas</h3>
        <p className="text-sm text-gray mb-md">Home Pro and Pro+ are available in these areas. Check if your zip code is covered.</p>
        <ServiceAreaMap userZip={home?.zip_code} compact />
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

      {/* Plan Change Confirmation Modal */}
      {planChangeModal.visible && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !planChangeModal.confirming) closePlanChangeModal(); }}
        >
          <div style={{
            background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460,
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${Colors.lightGray}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: Colors.charcoal }}>
                {planChangeModal.loading ? 'Loading...' : planChangeModal.preview?.change_type === 'upgrade' ? 'Confirm Upgrade' : planChangeModal.preview?.change_type === 'cancel' ? 'Cancel Subscription' : 'Confirm Plan Change'}
              </p>
              <button
                onClick={closePlanChangeModal}
                disabled={planChangeModal.confirming}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: Colors.medGray, padding: '4px 8px', lineHeight: 1 }}
                aria-label="Close"
              >&times;</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              {planChangeModal.loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
                  <div className="spinner" style={{ marginBottom: 12 }} />
                  <p style={{ fontSize: 14, color: Colors.medGray, margin: 0 }}>Calculating your plan change...</p>
                </div>
              ) : planChangeModal.preview ? (
                <>
                  {/* Plan change direction */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ textAlign: 'center', padding: '10px 16px', background: Colors.cream, borderRadius: 8, flex: 1 }}>
                      <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 2px' }}>Current</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: Colors.charcoal, margin: 0 }}>{planChangeModal.preview.current_name}</p>
                    </div>
                    <span style={{ fontSize: 20, color: Colors.copper }}>&rarr;</span>
                    <div style={{ textAlign: 'center', padding: '10px 16px', background: Colors.copperMuted, borderRadius: 8, flex: 1 }}>
                      <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 2px' }}>New Plan</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: Colors.copper, margin: 0 }}>{planChangeModal.preview.new_name}</p>
                    </div>
                  </div>

                  {/* Pricing details */}
                  {planChangeModal.preview.amount_due_now > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${Colors.lightGray}`, fontSize: 14 }}>
                      <span style={{ color: Colors.darkGray }}>Due now (prorated)</span>
                      <span style={{ fontWeight: 700, color: Colors.charcoal }}>${planChangeModal.preview.amount_due_now.toFixed(2)}</span>
                    </div>
                  )}
                  {planChangeModal.preview.proration_credit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${Colors.lightGray}`, fontSize: 14 }}>
                      <span style={{ color: Colors.darkGray }}>Prorated credit</span>
                      <span style={{ fontWeight: 700, color: Colors.sage }}>-${planChangeModal.preview.proration_credit.toFixed(2)}</span>
                    </div>
                  )}
                  {planChangeModal.preview.new_price_monthly !== undefined && planChangeModal.preview.new_price_monthly !== null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${Colors.lightGray}`, fontSize: 14 }}>
                      <span style={{ color: Colors.darkGray }}>New monthly rate</span>
                      <span style={{ fontWeight: 700, color: Colors.charcoal }}>
                        {planChangeModal.preview.new_price_monthly === 0 ? 'Free' : `$${planChangeModal.preview.new_price_monthly.toFixed(2)}/mo`}
                      </span>
                    </div>
                  )}

                  {/* Message */}
                  <p style={{ fontSize: 14, color: Colors.darkGray, lineHeight: 1.6, margin: '16px 0 0' }}>
                    {planChangeModal.preview.message}
                  </p>

                  {/* Pro services note */}
                  {planChangeModal.preview.pro_services_note && (
                    <div style={{
                      marginTop: 12, padding: '10px 14px', borderRadius: 8,
                      background: '#FFF3E0', border: '1px solid #FFE0B2', fontSize: 13, color: '#E65100', lineHeight: 1.5,
                    }}>
                      {planChangeModal.preview.pro_services_note}
                    </div>
                  )}

                  {/* Confirm / Cancel buttons */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button
                      className="btn btn-ghost"
                      onClick={closePlanChangeModal}
                      disabled={planChangeModal.confirming}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      className={`btn ${planChangeModal.preview.change_type === 'upgrade' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={confirmPlanChange}
                      disabled={planChangeModal.confirming}
                      style={{ flex: 1 }}
                    >
                      {planChangeModal.confirming
                        ? 'Processing...'
                        : planChangeModal.preview.change_type === 'upgrade'
                          ? 'Confirm Upgrade'
                          : planChangeModal.preview.change_type === 'cancel'
                            ? 'Confirm Cancellation'
                            : 'Confirm Downgrade'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Stripe Checkout Modal */}
      {showCheckoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeCheckoutModal(); }}
        >
          <div style={{
            background: '#fff',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${Colors.lightGray}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: Colors.charcoal }}>
                  Upgrade to {PLANS.find(p => p.value === checkoutPlan)?.name || checkoutPlan}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: Colors.medGray }}>
                  Secure checkout powered by Stripe
                </p>
              </div>
              <button
                onClick={closeCheckoutModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: Colors.medGray,
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
                aria-label="Close checkout"
              >
                &times;
              </button>
            </div>

            {/* Stripe embedded checkout mounts here */}
            <div ref={checkoutRef} style={{ minHeight: 300 }}>
              {checkoutLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
                  <div className="spinner" style={{ marginBottom: 16 }} />
                  <p style={{ fontSize: 14, color: Colors.medGray, margin: 0 }}>Loading secure checkout...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
