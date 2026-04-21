import { CSSProperties, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { HealthGauge } from './HealthGauge';
import { track } from '@/utils/analytics';

interface DashboardHeroStripProps {
  /** 0–100 Home Health Score. Pass undefined if still loading; we'll render a neutral placeholder. */
  healthScore?: number;
  /** Human-readable Home Token completeness (e.g., "78% complete"). */
  tokenCompleteness?: string;
  /** Whether the user's tier gates the Home Token features. */
  tokenLocked?: boolean;
  /** Why Home Token is locked (tooltip-ready). */
  tokenLockReason?: string;
  style?: CSSProperties;
}

/**
 * DD-2: two-card hero strip beneath the DD-1 `<NextActionHero>`.
 *
 *   [ Home Health Score gauge · 1–2 line summary ]   [ Home Token · transfer CTA ]
 *
 * Free tier sees a locked variant on the right card that nudges upgrade.
 * Clicks fire `dashboard_health_click` / `dashboard_token_click` for the DX-1 funnel.
 */
export function DashboardHeroStrip({
  healthScore,
  tokenCompleteness,
  tokenLocked = false,
  tokenLockReason,
  style,
}: DashboardHeroStripProps) {
  const { colors } = useTheme();
  const navigate = useNavigate();

  const scoreTone = useMemo(() => {
    if (healthScore === undefined) return colors.medGray;
    if (healthScore >= 80) return colors.success;
    if (healthScore >= 60) return colors.sage;
    if (healthScore >= 40) return colors.warning;
    return colors.error;
  }, [healthScore, colors]);

  const handleHealthClick = () => {
    track('dashboard_health_click', { score: healthScore });
    navigate('/health-score');
  };

  const handleTokenClick = () => {
    track('dashboard_token_click');
    if (tokenLocked) {
      navigate('/subscription');
    } else {
      navigate('/home-report');
    }
  };

  const cardBase: CSSProperties = {
    flex: 1,
    minWidth: 260,
    background: colors.cardBackground,
    border: `1px solid ${colors.lightGray}`,
    borderRadius: 16,
    boxShadow: '0 1px 2px rgba(12, 13, 16, 0.04)',
    padding: 20,
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    transition: 'transform 150ms ease, box-shadow 150ms ease',
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        ...style,
      }}
    >
      {/* Health card */}
      <button
        type="button"
        onClick={handleHealthClick}
        aria-label={`Open Home Health Score drill-down. Current score ${healthScore ?? '—'}.`}
        style={{ ...cardBase, color: colors.charcoal }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 10px rgba(12, 13, 16, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(12, 13, 16, 0.04)';
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <HealthGauge score={healthScore ?? 0} size={80} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: scoreTone,
              marginBottom: 4,
            }}
          >
            Home Health
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.charcoal,
              marginBottom: 2,
            }}
          >
            {healthScore === undefined ? 'Calculating…' : `${healthScore} / 100`}
          </div>
          <div style={{ fontSize: 13, color: colors.medGray }}>
            See what's moving the needle →
          </div>
        </div>
      </button>

      {/* Home Token card */}
      <button
        type="button"
        onClick={handleTokenClick}
        aria-label={
          tokenLocked
            ? 'Home Token is included on Home and Pro plans. Tap to upgrade.'
            : 'Open Home Report and Home Token transfer'
        }
        style={{
          ...cardBase,
          color: colors.charcoal,
          opacity: tokenLocked ? 0.95 : 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 10px rgba(12, 13, 16, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(12, 13, 16, 0.04)';
        }}
      >
        <div
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: 12,
            background: tokenLocked ? colors.lightGray : `${colors.copper}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          {tokenLocked ? '🔒' : '🏠'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: tokenLocked ? colors.medGray : colors.copperDark,
              marginBottom: 4,
            }}
          >
            {tokenLocked ? 'Upgrade to unlock' : 'Home Token'}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.charcoal,
              marginBottom: 2,
            }}
          >
            {tokenLocked
              ? 'Boost your list price'
              : tokenCompleteness ?? 'Transfer-ready'}
          </div>
          <div style={{ fontSize: 13, color: colors.medGray }}>
            {tokenLocked
              ? tokenLockReason ?? 'Home Token ships with Home and Pro plans.'
              : 'Share with a buyer or agent →'}
          </div>
        </div>
      </button>
    </div>
  );
}
