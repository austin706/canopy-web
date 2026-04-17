/**
 * Pro Payouts — earnings and payout history for the signed-in pro provider.
 *
 * Read side: list of pro_payouts rows with status, amount, and visit context.
 * Write side: "Request payout" button for completed visits that haven't been
 * paid yet (or whose auto-payout failed). Calls process-pro-payout edge function.
 *
 * This page is the target of the notification action_url set in
 * /supabase/functions/process-pro-payout/index.ts when a payout clears.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import {
  getProviderPayouts,
  getProviderPayoutSummary,
  getUnpaidCompletedVisits,
  triggerManualPayout,
  getStripeConnectLiveStatus,
  type ProPayoutRow,
} from '@/services/pro';
import { Colors } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';
import { showToast } from '@/components/Toast';
import logger from '@/utils/logger';

interface UnpaidVisit {
  id: string;
  completed_at: string | null;
  scheduled_date: string | null;
  payout_status: string | null;
  payout_amount_cents: number | null;
}

const fmtUSD = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString() : '—';

const statusPill = (s: ProPayoutRow['status']) => {
  const colors = {
    paid: { bg: Colors.sage + '22', fg: Colors.sage },
    processing: { bg: Colors.warning + '22', fg: Colors.warning },
    failed: { bg: Colors.error + '22', fg: Colors.error },
  } as const;
  const c = colors[s] || { bg: Colors.lightGray, fg: Colors.medGray };
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
      }}
    >
      {s}
    </span>
  );
};

export default function ProPayouts() {
  const navigate = useNavigate();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<ProPayoutRow[]>([]);
  const [summary, setSummary] = useState({ paidCents: 0, processingCents: 0, failedCents: 0, count: 0 });
  const [unpaid, setUnpaid] = useState<UnpaidVisit[]>([]);
  const [stripeStatus, setStripeStatus] = useState<{ payoutsEnabled?: boolean; onboardingComplete?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (!authUser?.user) {
          navigate('/pro-login');
          return;
        }
        const { data: provider, error: pErr } = await supabase
          .from('pro_providers')
          .select('id')
          .eq('user_id', authUser.user.id)
          .single();
        if (pErr || !provider) {
          navigate('/pro-portal');
          return;
        }
        setProviderId(provider.id);

        const [payoutsData, summaryData, unpaidData, statusData] = await Promise.all([
          getProviderPayouts(provider.id),
          getProviderPayoutSummary(provider.id),
          getUnpaidCompletedVisits(provider.id),
          getStripeConnectLiveStatus(provider.id).catch(() => null),
        ]);

        setPayouts(payoutsData);
        setSummary(summaryData);
        setUnpaid(unpaidData);
        setStripeStatus(statusData);
      } catch (err) {
        logger.error('Failed to load pro payouts', err);
        showToast({ message: 'Failed to load payout history' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const handleRequestPayout = async (visitId: string) => {
    setTriggering(visitId);
    try {
      const result = await triggerManualPayout(visitId);
      if (!result.success) {
        showToast({ message: result.error || 'Payout failed' });
        return;
      }
      showToast({ message: `Payout of ${fmtUSD(result.amount_cents || 0)} queued — arrives in 2-3 business days` });
      // Refresh
      if (providerId) {
        const [payoutsData, summaryData, unpaidData] = await Promise.all([
          getProviderPayouts(providerId),
          getProviderPayoutSummary(providerId),
          getUnpaidCompletedVisits(providerId),
        ]);
        setPayouts(payoutsData);
        setSummary(summaryData);
        setUnpaid(unpaidData);
      }
    } finally {
      setTriggering(null);
    }
  };

  if (loading) return <PageSkeleton />;

  const connectReady = stripeStatus?.payoutsEnabled ?? false;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Payouts</h1>
          <p style={{ color: Colors.medGray, margin: '4px 0 0' }}>
            Earnings and payout history for your Canopy visits.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/pro-portal')}>
          ← Back to Pro Portal
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <SummaryCard label="Paid out" value={fmtUSD(summary.paidCents)} accent={Colors.sage} />
        <SummaryCard label="Processing" value={fmtUSD(summary.processingCents)} accent={Colors.warning} />
        <SummaryCard label="Failed" value={fmtUSD(summary.failedCents)} accent={Colors.error} />
        <SummaryCard label="Total payouts" value={String(summary.count)} accent={Colors.charcoal} />
      </div>

      {/* Stripe Connect warning */}
      {!connectReady && (
        <div
          style={{
            background: Colors.warning + '15',
            border: `1px dashed ${Colors.warning}`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <strong>Stripe Connect onboarding incomplete.</strong> Finish your Stripe setup before
          payouts can be processed.{' '}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => navigate('/pro-portal/onboarding')}
            style={{ marginLeft: 8 }}
          >
            Finish setup
          </button>
        </div>
      )}

      {/* Unpaid completed visits — manual request */}
      {unpaid.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: 0, marginBottom: 4 }}>
            Awaiting payout ({unpaid.length})
          </h3>
          <p style={{ color: Colors.medGray, margin: 0, marginBottom: 12, fontSize: 13 }}>
            Completed visits where auto-payout hasn't landed. You can request payout manually.
          </p>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${Colors.lightGray}` }}>
                <th style={thStyle}>Completed</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {unpaid.map((v) => (
                <tr key={v.id} style={{ borderBottom: `1px solid ${Colors.lightGray}` }}>
                  <td style={tdStyle}>{fmtDate(v.completed_at || v.scheduled_date)}</td>
                  <td style={tdStyle}>{v.payout_amount_cents ? fmtUSD(v.payout_amount_cents) : 'Default'}</td>
                  <td style={tdStyle}>{v.payout_status || 'awaiting'}</td>
                  <td style={tdStyle}>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={triggering === v.id || !connectReady}
                      onClick={() => handleRequestPayout(v.id)}
                      title={!connectReady ? 'Complete Stripe onboarding first' : 'Send payout now'}
                    >
                      {triggering === v.id ? 'Requesting…' : 'Request payout'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payout history */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 12 }}>
          Payout history ({payouts.length})
        </h3>
        {payouts.length === 0 ? (
          <p style={{ color: Colors.medGray, margin: 0 }}>
            No payouts yet. Complete a bimonthly visit to receive your first payout.
          </p>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${Colors.lightGray}` }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Visit</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Transfer</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${Colors.lightGray}` }}>
                  <td style={tdStyle}>{fmtDate(p.paid_at || p.created_at)}</td>
                  <td style={tdStyle}>
                    {p.visit?.completed_at ? fmtDate(p.visit.completed_at) : p.visit_id.slice(0, 8)}
                  </td>
                  <td style={tdStyle}>{fmtUSD(p.amount_cents)}</td>
                  <td style={tdStyle}>{statusPill(p.status)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: Colors.medGray }}>
                    {p.stripe_transfer_id || (p.stripe_error ? `⚠ ${p.stripe_error.slice(0, 40)}…` : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 16 }}>
        Payouts are sent via Stripe to your connected bank account. Funds typically arrive within 2-3
        business days of processing.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: Colors.medGray, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 6px', fontSize: 12, color: Colors.medGray, textTransform: 'uppercase', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'top' };
