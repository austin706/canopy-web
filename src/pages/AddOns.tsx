import { useState, useEffect } from 'react';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

interface AddOnEstimate {
  category_id: string;
  display_name: string;
  description: string;
  icon: string;
  color: string;
  estimated_price: number;
  frequency: string;
  is_recurring: boolean;
  applicable: boolean;
  not_applicable_reason: string | null;
  price_range: { min: number; max: number };
}

interface HomeAddOn {
  id: string;
  category_id: string;
  status: string;
  estimated_price: number | null;
  quoted_price: number | null;
  approved_price: number | null;
  billing_frequency: string | null;
  next_service_date: string | null;
  assigned_provider_id: string | null;
}

const ICON_MAP: Record<string, string> = {
  bug: '🐛', leaf: '🌿', water: '💧', settings: '⚙️', sparkles: '✨',
  thermometer: '🌡️', flame: '🔥', droplets: '💦', grid: '🔲', zap: '⚡',
  wind: '💨', truck: '🚛', droplet: '💧', beaker: '🧪',
};

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly', bimonthly: 'Every 2 months', quarterly: 'Quarterly',
  biannual: 'Twice/year', annual: 'Annual', as_needed: 'As needed',
};

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  requested: { label: 'Requested', bg: Colors.warning + '20', color: Colors.warning },
  assessing: { label: 'Being Assessed', bg: Colors.info + '20', color: Colors.info },
  quoted: { label: 'Quote Ready', bg: Colors.copper + '20', color: Colors.copper },
  approved: { label: 'Approved', bg: Colors.sage + '20', color: Colors.sage },
  active: { label: 'Active', bg: Colors.success + '20', color: Colors.success },
  paused: { label: 'Paused', bg: Colors.medGray + '20', color: Colors.medGray },
  cancelled: { label: 'Cancelled', bg: Colors.error + '20', color: Colors.error },
};

export default function AddOns() {
  const { user, home } = useStore();
  const navigate = useNavigate();

  const [estimates, setEstimates] = useState<AddOnEstimate[]>([]);
  const [myAddOns, setMyAddOns] = useState<HomeAddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [serviceNotes, setServiceNotes] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const tier = user?.subscription_tier || 'free';
  const hasAccess = tier === 'home' || tier === 'pro' || tier === 'pro_plus';

  useEffect(() => {
    if (home && user) {
      loadData();
    }
  }, [home, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch estimates from edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && home) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/estimate-add-on-price`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ home_id: home.id }),
        });
        const data = await res.json();
        if (data.estimates) setEstimates(data.estimates);
      }

      // Fetch existing add-ons for this home
      if (home) {
        const { data: addOns } = await supabase
          .from('home_add_ons')
          .select('*')
          .eq('home_id', home.id)
          .not('status', 'in', '("cancelled","expired")');
        if (addOns) setMyAddOns(addOns);
      }
    } catch (err) {
      console.warn('Failed to load add-on data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestQuote = async (categoryId: string) => {
    if (!home || !user) return;
    setRequesting(categoryId);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/request-add-on-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          home_id: home.id,
          category_id: categoryId,
          service_notes: serviceNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const est = estimates.find(e => e.category_id === categoryId);
      setSuccess(`Quote requested for ${est?.display_name || categoryId}! ${data.provider_assigned ? `Assigned to ${data.provider_name}.` : "We'll match you with a provider shortly."}`);
      setExpandedId(null);
      setServiceNotes('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to request quote');
    } finally {
      setRequesting(null);
    }
  };

  const handleApprove = async (addOnId: string) => {
    setApprovingId(addOnId);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-add-on-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ home_add_on_id: addOnId, source: 'web' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      if (data.mode === 'checkout' && data.url) {
        // Redirect to Stripe Checkout for first-time add-on subscribers
        window.location.href = data.url;
        return;
      }

      // Direct attach or invoice — no redirect needed
      setSuccess(`Service approved and billing activated! ($${data.approved_price}/period)`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  const handleCancelAddOn = async (addOnId: string) => {
    if (!confirm('Are you sure you want to cancel this add-on service? Billing will stop at the end of the current period.')) return;
    setCancellingId(addOnId);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-add-on`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ home_add_on_id: addOnId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancellation failed');

      setSuccess(`${data.cancelled_service} has been cancelled.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  };

  // Check for checkout success/cancel in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' && params.get('addon_id')) {
      setSuccess('Add-on service activated! Your provider will be in touch to schedule the first service.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('canceled') === 'true') {
      setError('Checkout was canceled. You can approve the quote anytime.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (!hasAccess) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `linear-gradient(135deg, ${Colors.sage}, ${Colors.copper})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 36, color: '#fff',
        }}>+</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: Colors.charcoal }}>Add-On Services</h3>
        <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.6, maxWidth: 400, margin: '0 auto 20px' }}>
          HVAC maintenance, pest control, lawn care, pool service, cleaning, and more — all managed through Canopy. Available on Home, Pro, and Pro+ plans.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/subscription')}>Upgrade to Access</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ color: Colors.medGray }}>Loading add-on services...</p>
      </div>
    );
  }

  // Split into active subscriptions and available catalog
  const activeAddOnIds = new Set(myAddOns.map(a => a.category_id));
  const availableEstimates = estimates.filter(e => !activeAddOnIds.has(e.category_id));
  const recurringEstimates = availableEstimates.filter(e => e.is_recurring && e.applicable);
  const seasonalEstimates = availableEstimates.filter(e => !e.is_recurring && e.applicable);
  const notApplicable = availableEstimates.filter(e => !e.applicable);

  return (
    <div>
      {/* Status messages */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, backgroundColor: Colors.error + '10', border: `1px solid ${Colors.error}30`, color: Colors.error, fontSize: 13 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, backgroundColor: Colors.success + '10', border: `1px solid ${Colors.success}30`, color: Colors.success, fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* Active Add-Ons */}
      {myAddOns.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>Your Add-On Services</h2>
          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
            Services you've subscribed to or have pending quotes.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myAddOns.map(addon => {
              const est = estimates.find(e => e.category_id === addon.category_id);
              const statusStyle = STATUS_STYLES[addon.status] || STATUS_STYLES.requested;
              const isQuoted = addon.status === 'quoted';
              const isApproving = approvingId === addon.id;

              return (
                <div key={addon.id} className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 24 }}>{ICON_MAP[est?.icon || ''] || '📋'}</span>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 15, color: Colors.charcoal, margin: 0 }}>
                            {est?.display_name || addon.category_id}
                          </p>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                            {FREQ_LABELS[est?.frequency || ''] || est?.frequency}
                          </p>
                        </div>
                      </div>

                      {/* Pricing info */}
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: Colors.charcoal, marginTop: 8 }}>
                        {addon.estimated_price && (
                          <span>Estimate: <strong>${addon.estimated_price}</strong></span>
                        )}
                        {addon.quoted_price && (
                          <span>Quoted: <strong style={{ color: Colors.copper }}>${addon.quoted_price}</strong></span>
                        )}
                        {addon.approved_price && (
                          <span>Active: <strong style={{ color: Colors.sage }}>${addon.approved_price}/{addon.billing_frequency}</strong></span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        backgroundColor: statusStyle.bg, color: statusStyle.color,
                      }}>{statusStyle.label}</span>

                      {isQuoted && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(addon.id)}
                          disabled={isApproving}
                          style={{ fontSize: 12, padding: '6px 16px' }}
                        >
                          {isApproving ? 'Approving...' : `Approve $${addon.quoted_price}`}
                        </button>
                      )}

                      {(addon.status === 'active' || addon.status === 'paused' || addon.status === 'approved') && (
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this service? This cannot be undone.')) {
                              handleCancelAddOn(addon.id);
                            }
                          }}
                          disabled={cancellingId === addon.id}
                          style={{
                            fontSize: 12, padding: '6px 16px',
                            backgroundColor: 'transparent', color: Colors.medGray,
                            border: `1px solid ${Colors.medGray}`, borderRadius: 6,
                          }}
                        >
                          {cancellingId === addon.id ? 'Cancelling...' : 'Cancel Service'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring Services Catalog */}
      {recurringEstimates.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>Recurring Services</h2>
          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
            Ongoing professional services for your home. Pricing is estimated based on your home's details and confirmed after an on-site assessment.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {recurringEstimates.map(est => renderCatalogCard(est))}
          </div>
        </div>
      )}

      {/* Seasonal / One-Time Services */}
      {seasonalEstimates.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>Seasonal & One-Time Services</h2>
          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
            Schedule these as needed. Priced per service based on your home.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {seasonalEstimates.map(est => renderCatalogCard(est))}
          </div>
        </div>
      )}

      {/* Not Applicable */}
      {notApplicable.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: Colors.medGray, marginBottom: 8 }}>Not Applicable to Your Home</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {notApplicable.map(est => (
              <div key={est.category_id} className="card" style={{ padding: '16px 18px', opacity: 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{ICON_MAP[est.icon] || '📋'}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: 0 }}>{est.display_name}</p>
                    <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>{est.not_applicable_reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  function renderCatalogCard(est: AddOnEstimate) {
    const isExpanded = expandedId === est.category_id;
    const isRequesting = requesting === est.category_id;

    return (
      <div
        key={est.category_id}
        className="card"
        style={{
          padding: '18px 20px',
          cursor: 'pointer',
          border: isExpanded ? `2px solid ${est.color || Colors.sage}` : '2px solid transparent',
          transition: 'border-color 0.2s',
        }}
        onClick={() => {
          setExpandedId(isExpanded ? null : est.category_id);
          setServiceNotes('');
          setError('');
          setSuccess('');
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: (est.color || Colors.sage) + '20', fontSize: 22, flexShrink: 0,
          }}>
            {ICON_MAP[est.icon] || '📋'}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 15, color: Colors.charcoal, margin: '0 0 2px' }}>{est.display_name}</p>
            <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 6px', lineHeight: 1.4 }}>{est.description}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {est.is_recurring ? (
                <span style={{ fontSize: 14, fontWeight: 700, color: est.color || Colors.sage }}>
                  ~${est.estimated_price}/mo
                </span>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 700, color: est.color || Colors.sage }}>
                  ${est.price_range.min}–${est.price_range.max}
                </span>
              )}
              <span style={{
                fontSize: 11, color: Colors.medGray, padding: '2px 8px',
                backgroundColor: Colors.cream, borderRadius: 4,
              }}>
                {FREQ_LABELS[est.frequency] || est.frequency}
              </span>
            </div>
          </div>
        </div>

        {/* Expanded request form */}
        {isExpanded && (
          <div
            style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${Colors.cream}` }}
            onClick={e => e.stopPropagation()}
          >
            {est.is_recurring && (
              <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 12px', lineHeight: 1.5 }}>
                Estimated at <strong>${est.estimated_price}/mo</strong> based on your home's size and features.
                A specialist will visit your property and confirm the exact price before you're charged.
              </p>
            )}

            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: Colors.charcoal }}>
              Notes for the provider (optional)
            </label>
            <textarea
              className="form-input"
              value={serviceNotes}
              onChange={e => setServiceNotes(e.target.value)}
              placeholder="Any specific concerns or details about your property..."
              style={{ minHeight: 60, resize: 'vertical', marginBottom: 12 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleRequestQuote(est.category_id)}
                disabled={isRequesting}
                style={{ backgroundColor: est.color || Colors.sage }}
              >
                {isRequesting ? 'Requesting...' : 'Request Quote'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setExpandedId(null); setServiceNotes(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}
