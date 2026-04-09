import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase, getStripeConnectLiveStatus } from '@/services/supabase';
import { Colors } from '@/constants/theme';

/**
 * Landing page after a pro completes Stripe Express onboarding.
 * Pulls LIVE status from Stripe (via edge function, which also syncs the DB flag),
 * then shows success state or a "still missing info" fallback with a retry link.
 */
export default function ProOnboardingSuccess() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    hasAccount: boolean;
    onboardingComplete: boolean;
    detailsSubmitted?: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id) {
        setError('You must be signed in to complete onboarding.');
        setLoading(false);
        return;
      }
      try {
        const { data: provider, error: provErr } = await supabase
          .from('pro_providers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (provErr) throw provErr;
        if (!provider) {
          if (!cancelled) {
            setError('No Certified Pro profile found for your account.');
            setLoading(false);
          }
          return;
        }
        const live = await getStripeConnectLiveStatus(provider.id);
        if (!cancelled) {
          setStatus(live);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to verify onboarding status.');
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const containerStyle: React.CSSProperties = {
    maxWidth: 560,
    margin: '0 auto',
    padding: 32,
    textAlign: 'center',
  };
  const cardStyle: React.CSSProperties = {
    background: 'var(--color-card-background)',
    borderRadius: 16,
    padding: 40,
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Verifying your Stripe account…</h2>
          <p style={{ color: Colors.medGray, marginTop: 8 }}>
            This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: Colors.medGray, marginBottom: 20 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/pro-portal/onboarding')}>
            Back to Onboarding
          </button>
        </div>
      </div>
    );
  }

  if (status?.onboardingComplete) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            You're all set
          </h2>
          <p style={{ color: Colors.medGray, marginBottom: 24, lineHeight: 1.6 }}>
            Your Stripe account is connected and ready to accept payouts.
            You can now receive jobs through Canopy.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/pro-portal')}>
              Go to Pro Portal
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/pro-portal/job-queue')}>
              View Job Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Account exists but Stripe still needs more info (e.g. user closed the browser early)
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Onboarding not quite finished
        </h2>
        <p style={{ color: Colors.medGray, marginBottom: 20, lineHeight: 1.6 }}>
          Stripe still needs some information before you can accept payouts.
        </p>
        <div style={{
          background: 'var(--color-cream, #F5F0E8)',
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
          textAlign: 'left',
          fontSize: 13,
          color: Colors.medGray,
        }}>
          <div>Details submitted: {status?.detailsSubmitted ? '✅' : '❌'}</div>
          <div>Charges enabled: {status?.chargesEnabled ? '✅' : '❌'}</div>
          <div>Payouts enabled: {status?.payoutsEnabled ? '✅' : '❌'}</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/pro-portal/onboarding')}>
          Finish Onboarding
        </button>
      </div>
    </div>
  );
}
