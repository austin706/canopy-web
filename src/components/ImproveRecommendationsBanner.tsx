// ═══════════════════════════════════════════════════════════════
// ImproveRecommendationsBanner — post-Quick-Start nudge (web)
// ═══════════════════════════════════════════════════════════════
// 2026-04-29: web parity for
// `Canopy-App/components/ImproveRecommendationsBanner.tsx`. Detects
// homes that look like they took the onboarding "Quick start" path
// (no foundation_type, no lawn_type, no equipment, no system flags
// set) and surfaces a single dismissible card prompting the user to
// fill in systems via /home-details.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';

const DISMISS_KEY_PREFIX = 'canopy.improveRec.dismissed.';

export default function ImproveRecommendationsBanner() {
  const navigate = useNavigate();
  const { user, home, equipment } = useStore();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    try {
      setDismissed(localStorage.getItem(`${DISMISS_KEY_PREFIX}${user.id}`) === '1');
    } catch {
      // localStorage unavailable (private mode); render the banner.
    }
  }, [user?.id]);

  if (dismissed || !home) return null;

  const lookedQuickStart =
    !home.foundation_type &&
    !home.lawn_type &&
    (!equipment || equipment.length === 0) &&
    !home.has_pool && !home.has_fireplace && !home.has_sprinkler_system;

  if (!lookedQuickStart) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (user?.id) localStorage.setItem(`${DISMISS_KEY_PREFIX}${user.id}`, '1');
    } catch { /* non-blocking */ }
  };

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        backgroundColor: `${Colors.copper}10`,
        border: `1px solid ${Colors.copper}30`,
        borderLeft: `4px solid ${Colors.copper}`,
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: `${Colors.copper}1F`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: 20,
        }}
        aria-hidden
      >
        ✨
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: Colors.charcoal, marginBottom: 4 }}>
          Sharpen your recommendations
        </div>
        <div style={{ fontSize: 13, color: Colors.medGray, lineHeight: 1.5, marginBottom: 8 }}>
          You took the quick start. Tell us about your home's systems and equipment so we can tailor the maintenance plan to what you actually have — takes about 2 minutes.
        </div>
        <button
          type="button"
          onClick={() => navigate('/home-details')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            fontSize: 13,
            fontWeight: 600,
            color: Colors.copper,
            cursor: 'pointer',
          }}
        >
          Tell us about your home →
        </button>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: 18,
          color: Colors.medGray,
          cursor: 'pointer',
          padding: 4,
          flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
