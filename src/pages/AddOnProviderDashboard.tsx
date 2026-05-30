import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import ProAddOnQuotes from '@/pages/ProAddOnQuotes';
import { getErrorMessage } from '@/utils/errors';
import logger from '@/utils/logger';

// AddOnProviderDashboard — main entry point for an active (or in-onboarding)
// add-on provider on the web.
//
// Gate: caller must own an add_on_providers row (provider_id = auth.uid()).
// If no row exists → push them to /apply-add-on-provider. If status is not
// 'active', render a status banner explaining the wait; the embedded quote
// queue is still shown for providers in 'onboarding' so they can familiarize
// themselves with the workflow, but RLS will keep results empty until they
// hold an assignment.
//
// The Phase 1 dashboard reuses the existing ProAddOnQuotes page (which is
// already structured as a queue of add-on requests assigned to the caller
// via assigned_provider_id). Phase 2 will swap this for a dedicated add-on
// provider quote queue keyed off add_on_providers.id.

interface ProviderState {
  id: string;
  status: 'applied' | 'onboarding' | 'active' | 'suspended' | 'rejected';
  category_id: string;
  company_name: string;
  stripe_connect_onboarding_complete: boolean | null;
}

export default function AddOnProviderDashboard() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderState[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id) {
        setError('You must be signed in to view the add-on provider dashboard.');
        setLoading(false);
        return;
      }
      try {
        const { data, error: pErr } = await supabase
          .from('add_on_providers')
          .select(
            'id, status, category_id, company_name, stripe_connect_onboarding_complete',
          )
          .eq('provider_id', user.id)
          .order('applied_at', { ascending: false });
        if (pErr) throw pErr;
        if (!data || data.length === 0) {
          if (!cancelled) navigate('/apply-add-on-provider');
          return;
        }
        if (!cancelled) {
          setProviders(data as ProviderState[]);
          setLoading(false);
        }
      } catch (e) {
        logger.error('AddOnProviderDashboard: load failed', e);
        if (!cancelled) {
          setError(getErrorMessage(e) || 'Failed to load provider dashboard.');
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: Colors.medGray }}>
        Loading add-on provider dashboard…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-error)' }}>
        {error}
      </div>
    );
  }

  // Active row is the one we actually surface in the header banner; if multiple
  // exist we summarize them all (a provider can serve multiple categories per
  // migration_054's UNIQUE (provider_id, category_id)).
  const anyActive = providers.some((p) => p.status === 'active');
  const anyOnboarding = providers.some((p) => p.status === 'onboarding' || p.status === 'applied');
  const anySuspended = providers.some((p) => p.status === 'suspended');

  return (
    <div className="page-wide" style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28 /* allow-lint */, margin: 0 }}>Add-On Provider Portal</h1>
        <p style={{ fontSize: 14 /* allow-lint */, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          {providers.length === 1
            ? providers[0].company_name
            : `${providers.length} category assignments`}
        </p>
      </div>

      {/* Status banners */}
      {anySuspended && (
        <Banner color={Colors.error}>
          One or more of your category assignments is currently suspended. Contact
          support@canopyhome.app to resolve.
        </Banner>
      )}
      {!anyActive && anyOnboarding && (
        <Banner color={Colors.copper}>
          Your application is under review. Finish onboarding (profile + Stripe
          Connect) so we can activate you for jobs.
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-primary"
              style={{ marginRight: 8 }}
              onClick={() => navigate('/add-on-provider/onboarding')}
            >
              Continue Onboarding
            </button>
          </div>
        </Banner>
      )}

      {/* Categories breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 32,
        }}
      >
        {providers.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 16,
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: 'var(--color-card)',
            }}
          >
            <div style={{ fontSize: 12 /* allow-lint */, fontWeight: 600, color: Colors.medGray, textTransform: 'uppercase' }}>
              {p.category_id}
            </div>
            <div style={{ fontSize: 16 /* allow-lint */, fontWeight: 700, marginTop: 2 }}>{p.company_name}</div>
            <StatusBadge status={p.status} />
            <div style={{ fontSize: 12 /* allow-lint */, color: Colors.medGray, marginTop: 8 }}>
              Stripe: {p.stripe_connect_onboarding_complete ? '✓ connected' : '— not yet'}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 20 /* allow-lint */, marginBottom: 8 }}>Quote Queue</h2>
      <p style={{ fontSize: 13 /* allow-lint */, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Add-on requests Canopy has assigned to you. Submit quotes here; the homeowner
        sees the price and frequency before approving.
      </p>
      {/* Embed the existing ProAddOnQuotes page — it already gates on the
          caller having an assigned_provider_id and uses submit-add-on-quote. */}
      <ProAddOnQuotes />
    </div>
  );
}

function Banner({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        background: color + '15',
        border: `1px solid ${color}40`,
        color: Colors.charcoal,
        marginBottom: 16,
        fontSize: 14 /* allow-lint */,
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    applied: { bg: Colors.warning + '20', color: Colors.warning },
    onboarding: { bg: Colors.copper + '20', color: Colors.copper },
    active: { bg: Colors.success + '20', color: Colors.success },
    suspended: { bg: Colors.error + '20', color: Colors.error },
    rejected: { bg: Colors.medGray + '20', color: Colors.medGray },
  };
  const s = styles[status] || styles.applied;
  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: 6,
        padding: '3px 10px',
        borderRadius: 5,
        fontSize: 11 /* allow-lint */,
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.color,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}
    >
      {status}
    </span>
  );
}
