import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase, refreshStripeConnectOnboarding } from '@/services/supabase';
import { Colors } from '@/constants/theme';

/**
 * Stripe redirects here if the pro's onboarding link expired or they abandoned
 * and came back later. We fetch a fresh link and bounce them straight into it.
 */
export default function ProOnboardingRefresh() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id) {
        setError('You must be signed in to continue onboarding.');
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
          if (!cancelled) setError('No Certified Pro profile found for your account.');
          return;
        }
        const { onboardingUrl } = await refreshStripeConnectOnboarding(provider.id);
        if (!cancelled) {
          // Redirect the current tab into Stripe's hosted onboarding
          window.location.href = onboardingUrl;
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to refresh onboarding link.');
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

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Couldn't resume onboarding
          </h2>
          <p style={{ color: Colors.medGray, marginBottom: 20 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/pro-portal/onboarding')}>
            Back to Onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Resuming your Stripe onboarding…</h2>
        <p style={{ color: Colors.medGray, marginTop: 8 }}>
          One moment — we're taking you back to Stripe.
        </p>
      </div>
    </div>
  );
}
