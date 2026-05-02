import { CSSProperties, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { FontSize } from '@/constants/theme';
import { HealthGauge } from './HealthGauge';
import { track } from '@/utils/analytics';

interface DashboardHeroStripProps {
  /** 0–100 Home Health Score. Pass undefined if still loading; we'll render a neutral placeholder. */
  healthScore?: number;
  /** 2026-04-29: optional breakdown components used to make the card behavior-driving.
   *  Surfaces the lowest-scoring driver inline + an actionable hint instead of
   *  only "tap to see more". When omitted, the card falls back to the prior
   *  generic copy. Source: services/utils.ts::calculateHealthScore. */
  healthBreakdown?: {
    rolling90: number;       // 0–100, rolling 90-day completion rate (50% weight)
    currentMonth: number;    // 0–100, this-month momentum (30% weight)
    overdueCount: number;    // count of currently-overdue tasks (20% weight as penalty)
    completedCount: number;  // this-month completed (for the actionable hint)
    totalCount: number;      // this-month eligible (for the actionable hint)
  };
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
  healthBreakdown,
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

  /**
   * 2026-04-29: pick the lowest-scoring driver and an actionable hint.
   * Logic:
   *   - if any tasks are overdue → highlight overdue (highest urgency, easiest win)
   *   - else if currentMonth < rolling90 → highlight current-month momentum slipping
   *   - else if rolling90 < 70 → highlight rolling completion rate
   *   - else → "you're on track" maintenance copy
   */
  const driverHint = useMemo<{ label: string; hint: string; tone: string } | null>(() => {
    if (!healthBreakdown || healthScore === undefined) return null;
    const { rolling90, currentMonth, overdueCount, completedCount, totalCount } = healthBreakdown;

    if (overdueCount > 0) {
      const pointsBack = overdueCount === 1 ? 1 : Math.min(overdueCount * 1, 10);
      return {
        label: `${overdueCount} overdue ${overdueCount === 1 ? 'task' : 'tasks'} pulling your score down`,
        hint: `Clear ${overdueCount === 1 ? 'it' : 'one'} this week to claw back ~${pointsBack} ${pointsBack === 1 ? 'point' : 'points'}.`,
        tone: colors.error,
      };
    }
    if (currentMonth < rolling90 - 10 && totalCount > 0) {
      const remaining = totalCount - completedCount;
      return {
        label: `Momentum slipping this month`,
        hint: `Knock out ${Math.min(3, Math.max(1, remaining))} of your ${totalCount} due tasks to keep the streak.`,
        tone: colors.warning,
      };
    }
    if (rolling90 < 70) {
      return {
        label: `90-day completion at ${rolling90}%`,
        hint: `Closing 2–3 tasks this week is the fastest way to lift this number.`,
        tone: colors.warning,
      };
    }
    return {
      label: `On track — ${rolling90}% 90-day completion`,
      hint: `Tap to see what would take you to 100.`,
      tone: colors.success,
    };
  }, [healthBreakdown, healthScore, colors]);

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
          {/* 2026-04-29: surface the breakdown driver inline so the score
              is a behavioral lever, not a vanity number. Falls back to the
              prior generic copy when breakdown data isn't supplied. */}
          {driverHint ? (
            <>
              <div style={{ fontSize: FontSize.sm, color: driverHint.tone, fontWeight: 600 }}>
                {driverHint.label}
              </div>
              <div style={{ fontSize: FontSize.xs, color: colors.medGray, marginTop: 2 }}>
                {driverHint.hint}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: colors.medGray }}>
              See what's moving the needle →
            </div>
          )}
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
