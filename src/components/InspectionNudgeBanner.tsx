// ═══════════════════════════════════════════════════════════════
// InspectionNudgeBanner — dashboard nudge for stale inspections
// ═══════════════════════════════════════════════════════════════
// 2026-05-02 (INSPECTION_STRATEGY): Surface the Annual Maintenance
// Inspection add-on for homes that:
//   - Are in a Pro-enabled service area
//   - Have never had a certified inspection OR last one was 12+ months ago
//   - Have Home or Home 2-Pack tier (Pro tier already gets visit-stamped
//     inspections via the auto-promote flow on bimonthly visits)
//
// Dismissal: localStorage-keyed by user_id. After dismissal, hide for
// 60 days; re-surface only if `selling_soon` flips to true (handled via
// the SalePrep wedge instead).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontSize } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { isProAvailableInArea, loadServiceAreas } from '@/services/subscriptionGate';

const DISMISS_KEY_PREFIX = 'canopy.inspectionNudge.dismissedUntil.';
const DISMISS_DAYS = 60;

export default function InspectionNudgeBanner() {
  const navigate = useNavigate();
  const { user, home } = useStore();
  const [show, setShow] = useState(false);
  const [neverInspected, setNeverInspected] = useState(true);

  useEffect(() => {
    if (!user?.id || !home) return;

    // Tier gate: only Home / Home 2-Pack. Pro/Pro_2 already get visit
    // auto-promoted inspections via the bimonthly visit flow.
    const tier = user.subscription_tier;
    if (tier !== 'home' && tier !== 'home_2') return;

    // Dismissal check
    try {
      const until = localStorage.getItem(`${DISMISS_KEY_PREFIX}${user.id}`);
      if (until && Date.now() < Number(until)) return;
    } catch { /* ignore */ }

    // Service-area gate — must be in a Pro-enabled ZIP
    (async () => {
      try { await loadServiceAreas(); } catch { /* ignore */ }
      const inArea = isProAvailableInArea(home.state ?? null, home.zip_code ?? null);
      if (!inArea) return;

      // Stale-inspection gate
      const lastAt = home.last_certified_inspection_at;
      if (lastAt) {
        const daysSince = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 365) return;
        setNeverInspected(false);
      } else {
        setNeverInspected(true);
      }

      setShow(true);
    })();
  }, [user?.id, user?.subscription_tier, home]);

  const handleDismiss = () => {
    setShow(false);
    if (!user?.id) return;
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(`${DISMISS_KEY_PREFIX}${user.id}`, String(until));
    } catch { /* ignore */ }
  };

  if (!show) return null;

  return (
    <div role="alert" style={{
      display: 'flex',
      gap: 12,
      padding: 16,
      marginBottom: 16,
      borderRadius: 12,
      background: `linear-gradient(135deg, ${Colors.cream} 0%, ${Colors.copper}12 100%)`,
      border: `1px solid ${Colors.copper}40`,
    }}>
      <div aria-hidden="true" style={{ fontSize: FontSize.xxl, lineHeight: 1, flexShrink: 0 }}>🛡️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: FontSize.xs, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: Colors.copper, margin: 0 }}>
          Document the care
        </p>
        <p style={{ fontSize: FontSize.sm, fontWeight: 600, color: Colors.charcoal, margin: '2px 0 4px' }}>
          {neverInspected
            ? 'Add a Canopy Maintenance Inspection to your Home Token'
            : 'Time to refresh your Maintenance Inspection'}
        </p>
        <p style={{ fontSize: FontSize.xs, color: Colors.medGray, margin: '0 0 10px', lineHeight: 1.4 }}>
          {neverInspected
            ? 'A Canopy-vetted Pro walks every system in your home and stamps a tamper-evident maintenance record onto your Home Token. Annual — $149/yr base.'
            : 'Your last Maintenance Inspection was over a year ago. Refresh it to keep the credibility on your Home Token current.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: Colors.copper, border: 'none' }}
            onClick={() => navigate('/add-ons?focus=inspection')}
          >
            Explore inspection
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDismiss}
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: 20, // allow-lint
          color: Colors.medGray,
          cursor: 'pointer',
          padding: 4,
          flexShrink: 0,
          lineHeight: 1,
          alignSelf: 'flex-start',
        }}
      >
        ×
      </button>
    </div>
  );
}
