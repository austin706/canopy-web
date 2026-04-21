import { CSSProperties, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import {
  pickHeroAction,
  type DashboardPriorityItem,
  type PriorityAddonInput,
  type PrioritySetupInput,
  type PriorityTaskInput,
} from '@/utils/dashboardPriority';

interface NextActionHeroProps {
  tasks: PriorityTaskInput[];
  setup?: PrioritySetupInput[];
  addons?: PriorityAddonInput[];
  /** Optional click handler — if not provided, router.push(href) is used. */
  onActionClick?: (item: DashboardPriorityItem) => void;
  style?: CSSProperties;
  /** Hide entirely when there's nothing to surface (default true). */
  hideWhenEmpty?: boolean;
}

/**
 * Hero card that surfaces the single highest-priority next action on the
 * dashboard (DD-1 / DD-10). Paired with progressive-disclosure sections below.
 *
 * Keep visually aligned with the mobile `NextActionHero` under `Canopy-App`.
 */
export function NextActionHero({
  tasks,
  setup = [],
  addons = [],
  onActionClick,
  style,
  hideWhenEmpty = true,
}: NextActionHeroProps) {
  const { colors } = useTheme();
  const navigate = useNavigate();

  const hero = useMemo(
    () => pickHeroAction({ tasks, setup, addons, now: new Date() }),
    [tasks, setup, addons],
  );

  if (!hero && hideWhenEmpty) return null;

  const handleClick = () => {
    if (!hero) return;
    if (onActionClick) {
      onActionClick(hero);
      return;
    }
    if (hero.href) navigate(hero.href);
  };

  // Accent color keyed to reason — semantic, not decorative.
  const accent = (() => {
    if (!hero) return colors.sage;
    switch (hero.reason) {
      case 'overdue':
        return colors.error;
      case 'weather':
        return colors.warning;
      case 'due_soon':
        return colors.sage;
      case 'setup':
        return colors.info;
      case 'addon':
        return colors.medGray;
      default:
        return colors.sage;
    }
  })();

  const eyebrow = (() => {
    if (!hero) return 'All caught up';
    switch (hero.reason) {
      case 'overdue':
        return 'Overdue — take care of this first';
      case 'weather':
        return 'Weather-triggered';
      case 'due_soon':
        return 'Up next';
      case 'setup':
        return 'Finish setting up';
      case 'addon':
        return 'Suggested service';
      default:
        return 'Up next';
    }
  })();

  return (
    <section
      aria-label="Next action"
      style={{
        borderRadius: 16,
        background: colors.cardBackground,
        border: `1px solid ${colors.lightGray}`,
        boxShadow: '0 1px 2px rgba(12, 13, 16, 0.04)',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {/* Accent stripe */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          background: accent,
        }}
      />
      <div
        style={{
          padding: '20px 20px 20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: accent,
              marginBottom: 6,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: colors.charcoal,
              lineHeight: 1.3,
              marginBottom: 4,
            }}
          >
            {hero ? hero.label : "You're all set for today"}
          </div>
          <div style={{ fontSize: 14, color: colors.medGray }}>
            {hero
              ? hero.badge
              : 'Nothing needs your attention right now. Check back tomorrow.'}
          </div>
        </div>
        {hero && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleClick}
            style={{
              minHeight: 44,
              padding: '10px 20px',
              whiteSpace: 'nowrap',
            }}
          >
            {hero.source === 'setup'
              ? 'Continue setup'
              : hero.source === 'addon'
              ? 'Learn more'
              : 'Open'}
          </button>
        )}
      </div>
    </section>
  );
}
