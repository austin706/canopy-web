// First-login onboarding explainer for Certified Pros.
// Shown above the Pro Portal dashboard until dismissed. Covers the three
// things every new Pro needs to know:
//   1. 15% Canopy platform fee on completed jobs
//   2. How jobs flow through the queue and Service Calendar
//   3. Stripe Connect payout setup
// Dismissal persists per-user via localStorage key keyed on the user id.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';

interface Props {
  userId: string;
  hasCompletedJobs: boolean;
}

const STORAGE_KEY = (uid: string) => `canopy.pro.onboarding.dismissed.${uid}`;

export default function ProOnboardingExplainer({ userId, hasCompletedJobs }: Props) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY(userId)) === '1';
    } catch {
      return false;
    }
  });

  // Auto-hide once the pro has shipped real work — the tour is redundant then.
  if (dismissed || hasCompletedJobs) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY(userId), '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div
      style={{
        background: Colors.cream,
        border: `2px solid ${Colors.copper}`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        position: 'relative',
      }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss onboarding"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'transparent',
          border: 'none',
          fontSize: 20,
          color: Colors.medGray,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ×
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>👋</span>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, margin: 0 }}>
          Welcome to Canopy Pro
        </h2>
      </div>
      <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.6, margin: '0 0 16px' }}>
        Here's how the platform works so you can hit the ground running.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {/* Fee disclosure — must be front and center */}
        <div style={{ background: Colors.white, border: `1px solid ${Colors.lightGray}`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: Colors.copper, marginBottom: 4 }}>
            💰 Platform fee: 15%
          </div>
          <p style={{ fontSize: 13, color: Colors.charcoal, lineHeight: 1.6, margin: 0 }}>
            Canopy takes a 15% fee on the total of every completed job — no monthly fees, no lead-bidding, no subscription. Stripe processing fees apply on payouts (industry standard). Full terms in the{' '}
            <a href="/contractor-terms" style={{ color: Colors.copper }}>Contractor Agreement</a>.
          </p>
        </div>

        <div style={{ background: Colors.white, border: `1px solid ${Colors.lightGray}`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: Colors.sage, marginBottom: 4 }}>
            📋 Claim jobs from the Job Queue
          </div>
          <p style={{ fontSize: 13, color: Colors.charcoal, lineHeight: 1.6, margin: 0 }}>
            When a homeowner in your service area requests work, it lands in the Job Queue. Claim the ones you want — first-come, first-served. Claimed jobs move to your Service Calendar where you schedule the visit with the homeowner.
          </p>
        </div>

        <div style={{ background: Colors.white, border: `1px solid ${Colors.lightGray}`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: Colors.warning, marginBottom: 4 }}>
            💳 Finish Stripe Connect setup
          </div>
          <p style={{ fontSize: 13, color: Colors.charcoal, lineHeight: 1.6, margin: 0 }}>
            Payouts go straight to your bank via Stripe Connect. If you haven't finished onboarding, head to the Profile screen and complete the verification — otherwise completed jobs will queue up unpaid.
          </p>
        </div>

        <div style={{ background: Colors.white, border: `1px solid ${Colors.lightGray}`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: Colors.charcoal, marginBottom: 4 }}>
            🗓 Quotes, invoices, visit notes
          </div>
          <p style={{ fontSize: 13, color: Colors.charcoal, lineHeight: 1.6, margin: 0 }}>
            Everything lives in your portal. Send quotes, file invoices, log visit summaries with photos, and Canopy handles the communication back to the homeowner's app.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/pro-portal/profile')}
          style={{
            background: Colors.copper,
            color: Colors.white,
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Complete my profile
        </button>
        <button
          onClick={() => navigate('/pro-portal/job-queue')}
          style={{
            background: Colors.white,
            color: Colors.charcoal,
            border: `1px solid ${Colors.lightGray}`,
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          View the Job Queue
        </button>
        <button
          onClick={dismiss}
          style={{
            background: 'transparent',
            color: Colors.medGray,
            border: 'none',
            padding: '10px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Got it, don't show again
        </button>
      </div>
    </div>
  );
}
