import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Colors, StatusColors } from '@/constants/theme';
import type { ProPlusSubscription } from '@/types';

export default function ProPlusManage() {
  const { user } = useStore();
  const [subscription, setSubscription] = useState<ProPlusSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    if (user) {
      loadSubscription();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      // const sub = await getProPlusStatus(user!.id);
      // setSubscription(sub);
      setSubscription(null);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestConsultation = async () => {
    if (!user) return;
    setActionInProgress(true);
    try {
      // await requestConsultation(user.id);
      // await loadSubscription();
      alert('Consultation request submitted! We will be in touch soon.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleApproveQuote = async () => {
    if (!subscription) return;
    setActionInProgress(true);
    try {
      // await approveQuote(subscription.id);
      // await loadSubscription();
      alert('Quote approved! Your Pro+ subscription is now active.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeclineQuote = async () => {
    if (!subscription) return;
    setActionInProgress(true);
    try {
      // await rejectQuote(subscription.id);
      // await loadSubscription();
      alert('Quote declined.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const handlePause = async () => {
    if (!subscription) return;
    if (!window.confirm('Pause your Pro+ subscription?')) return;
    setActionInProgress(true);
    try {
      // await pauseProPlus(subscription.id);
      // await loadSubscription();
      alert('Subscription paused.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;
    if (!window.confirm('Are you sure you want to cancel Pro+? This action cannot be undone.')) return;
    setActionInProgress(true);
    try {
      // await cancelProPlus(subscription.id);
      // await loadSubscription();
      alert('Subscription cancelled.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner"></div>
        <p>Loading subscription...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <h1>Pro+ Subscription</h1>
      </div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 8, background: '#E5393520', color: '#C62828', fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {/* No Subscription State */}
      {!subscription ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 20, color: Colors.copper }}>+</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Pro+ Maintenance</h2>
          <p className="text-gray mb-lg">
            Get unlimited routine maintenance visits and priority scheduling. Our Pro+ team handles filter changes, gutter cleaning, seasonal inspections, and more—all included in one monthly rate.
          </p>
          <p className="text-gray" style={{ fontSize: 13, marginBottom: 24, color: Colors.medGray }}>
            Larger projects (repairs, renovations, equipment replacement) will be quoted separately.
          </p>
          <button className="btn btn-primary btn-lg" onClick={handleRequestConsultation} disabled={actionInProgress}>
            {actionInProgress ? 'Requesting...' : 'Request a Consultation'}
          </button>
        </div>
      ) : subscription.status === 'consultation_requested' ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Consultation Requested</h2>
            <span className="badge" style={{ background: StatusColors.pending + '20', color: StatusColors.pending }}>Pending</span>
          </div>
          <p className="text-gray mb-lg">
            We've received your consultation request. Our team will reach out within 24 hours to discuss your home's maintenance needs and provide a custom quote.
          </p>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/subscription'}>View All Plans</button>
        </div>
      ) : subscription.status === 'quote_pending' ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Your Pro+ Quote</h2>
            <span className="badge" style={{ background: StatusColors.pending + '20', color: StatusColors.pending }}>Review Needed</span>
          </div>

          <div style={{ padding: 16, background: Colors.cream, borderRadius: 8, marginBottom: 20 }}>
            <p className="text-xs fw-600 text-copper mb-sm">Monthly Rate</p>
            <p style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{formatCurrency(subscription.quoted_monthly_rate ?? 0)}</p>
            <p className="text-xs text-gray">Valid until {formatDate(subscription.quote_valid_until ?? '')}</p>
          </div>

          {subscription.coverage_notes && (
            <div style={{ marginBottom: 16 }}>
              <p className="text-xs fw-600 mb-sm">Coverage Includes</p>
              <p className="text-sm text-gray">{subscription.coverage_notes}</p>
            </div>
          )}

          {subscription.scope_exclusions && (
            <div style={{ padding: 12, background: '#FFF3CD', borderRadius: 8, marginBottom: 20, borderLeft: `4px solid #FFC107` }}>
              <p className="text-xs fw-600 mb-sm">Scope Note</p>
              <p className="text-sm" style={{ margin: 0, color: '#856404' }}>
                Your Pro+ subscription covers routine ongoing maintenance. Larger projects (repairs, renovations, etc.) will be quoted separately.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleDeclineQuote} disabled={actionInProgress} style={{ flex: 1 }}>
              {actionInProgress ? 'Processing...' : 'Decline'}
            </button>
            <button className="btn btn-primary" onClick={handleApproveQuote} disabled={actionInProgress} style={{ flex: 1 }}>
              {actionInProgress ? 'Approving...' : 'Approve & Activate'}
            </button>
          </div>
        </div>
      ) : subscription.status === 'active' ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Pro+ Active</h2>
            <span className="badge" style={{ background: Colors.sage + '20', color: Colors.sage }}>Active</span>
          </div>

          <div style={{ padding: 16, background: Colors.cream, borderRadius: 8, marginBottom: 20 }}>
            <p className="text-xs fw-600 text-copper mb-sm">Monthly Rate</p>
            <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{formatCurrency(subscription.current_monthly_rate ?? 0)}</p>
            <p className="text-xs text-gray">Started: {formatDate(subscription.started_at ?? '')}</p>
          </div>

          {subscription.provider?.business_name && (
            <div style={{ marginBottom: 16 }}>
              <p className="text-xs fw-600 mb-sm">Assigned Provider</p>
              <p style={{ fontWeight: 500, fontSize: 13 }}>{subscription.provider.business_name}</p>
            </div>
          )}

          {subscription.coverage_notes && (
            <div style={{ marginBottom: 16 }}>
              <p className="text-xs fw-600 mb-sm">What's Covered</p>
              <p className="text-sm text-gray">{subscription.coverage_notes}</p>
            </div>
          )}

          <div style={{ padding: 12, background: '#FFF3CD', borderRadius: 8, marginBottom: 20, borderLeft: `4px solid #FFC107` }}>
            <p className="text-sm" style={{ margin: 0, color: '#856404' }}>
              Your Pro+ subscription covers routine ongoing maintenance. Larger projects (repairs, renovations, etc.) will be quoted separately.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handlePause} disabled={actionInProgress} style={{ flex: 1 }}>
              {actionInProgress ? 'Processing...' : 'Pause'}
            </button>
            <button className="btn" style={{ flex: 1, background: '#dc3545', color: 'white' }} onClick={handleCancel} disabled={actionInProgress}>
              {actionInProgress ? 'Processing...' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : subscription.status === 'paused' ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Pro+ Paused</h2>
            <span className="badge" style={{ background: StatusColors.paused + '20', color: StatusColors.paused }}>Paused</span>
          </div>
          <p className="text-gray mb-lg">
            Your Pro+ subscription is paused. You can resume it at any time, or contact us if you need help.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.href = '/subscription'}>Resume Subscription</button>
        </div>
      ) : null}
    </div>
  );
}
