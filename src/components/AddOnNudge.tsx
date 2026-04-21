// ═══════════════════════════════════════════════════════════════
// AddOnNudge — post-task "add this to your plan" prompt
// ═══════════════════════════════════════════════════════════════
//
// When a user completes a maintenance task whose category maps to an
// available recurring add-on (pest, lawn, pool, septic, cleaning), we
// surface a small toast inviting them to offload it to a Certified Pro.
//
// Triggering: callers fire `nudgeAddOnFromTaskCategory(category)` from
// any task-completion handler. This component subscribes to the same
// in-memory event channel and renders a dismissible toast.
//
// Suppression (DD-5):
//   - Per-user dismissal state is persisted in profiles.dismissed_nudges
//     JSONB via the `dismiss_nudge` RPC (count + last_dismissed_at).
//   - 30-day debounce per category.
//   - After 3 dismissals the nudge stops permanently and a one-time
//     "We'll stop suggesting X. You can add it anytime from Pro Services."
//     toast is surfaced on dismissal #3.
//   - Also suppressed entirely for slugs the user already subscribes to
//     (caller passes activeAddOnSlugs).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dismissNudge,
  fetchDismissedNudges,
  isNudgeActive,
  MAX_DISMISSALS_BEFORE_PERMANENT,
  type DismissedNudgesMap,
} from '@/services/nudges';

type AddOnSlug = 'pest_control' | 'lawn' | 'pool' | 'septic' | 'cleaning';

const CATEGORY_TO_SLUG: Record<string, AddOnSlug> = {
  pest_control: 'pest_control',
  lawn: 'lawn',
  sprinkler: 'lawn',
  pool: 'pool',
  septic: 'septic',
  cleaning: 'cleaning',
};

const SLUG_LABEL: Record<AddOnSlug, { name: string; tagline: string; friendly: string }> = {
  pest_control: { name: 'Pest Shield',    tagline: 'Quarterly treatments + free re-services. Tulsa Certified Pros.', friendly: 'pest control' },
  lawn:         { name: 'Lawn Care',      tagline: 'Mow, edge, fertilize — bi-weekly schedule built around your yard.', friendly: 'lawn care' },
  pool:         { name: 'Pool Service',   tagline: 'Weekly chemistry, cleaning, and equipment checks.', friendly: 'pool service' },
  septic:       { name: 'Septic Care',    tagline: 'Inspections, pumping reminders, and on-call response.', friendly: 'septic care' },
  cleaning:     { name: 'House Cleaning', tagline: 'Bi-weekly deep clean, scoped to your home size.', friendly: 'house cleaning' },
};

const nudgeKeyFor = (slug: AddOnSlug) => `addon.${slug}`;

// In-memory event channel. Module-level listener set so any caller can fire.
type Listener = (slug: AddOnSlug) => void;
const listeners: Set<Listener> = new Set();

export function nudgeAddOnFromTaskCategory(taskCategory: string | null | undefined): void {
  if (!taskCategory) return;
  const slug = CATEGORY_TO_SLUG[taskCategory];
  if (!slug) return;
  listeners.forEach((fn) => fn(slug));
}

interface Props {
  /** Slugs the user already has — suppresses the matching nudge. */
  activeAddOnSlugs?: AddOnSlug[];
}

export default function AddOnNudge({ activeAddOnSlugs = [] }: Props) {
  const navigate = useNavigate();
  const [active, setActive] = useState<AddOnSlug | null>(null);
  const [dismissed, setDismissed] = useState<DismissedNudgesMap>({});
  const [sessionShown, setSessionShown] = useState<Set<AddOnSlug>>(new Set());
  const [permanentToast, setPermanentToast] = useState<AddOnSlug | null>(null);

  // Lazy-load dismissed state once; keep in sync after each dismissal.
  useEffect(() => {
    let mounted = true;
    fetchDismissedNudges().then((map) => {
      if (mounted) setDismissed(map);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const fn: Listener = (slug) => {
      if (activeAddOnSlugs.includes(slug)) return;
      if (sessionShown.has(slug)) return;
      if (!isNudgeActive(dismissed, nudgeKeyFor(slug))) return;
      setSessionShown((prev) => {
        const next = new Set(prev);
        next.add(slug);
        return next;
      });
      setActive(slug);
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, [activeAddOnSlugs, dismissed, sessionShown]);

  const handleDismiss = async () => {
    const slug = active;
    if (!slug) return;
    setActive(null);
    try {
      const newCount = await dismissNudge(nudgeKeyFor(slug));
      // Update local cache so the same category is suppressed immediately.
      setDismissed((prev) => ({
        ...prev,
        [nudgeKeyFor(slug)]: { count: newCount, last_dismissed_at: new Date().toISOString() },
      }));
      if (newCount >= MAX_DISMISSALS_BEFORE_PERMANENT) {
        setPermanentToast(slug);
      }
    } catch {
      // Swallow — dismissing is best-effort; we already hid the nudge.
    }
  };

  // One-time "we'll stop suggesting X" toast. Auto-hides after 6s.
  useEffect(() => {
    if (!permanentToast) return;
    const t = setTimeout(() => setPermanentToast(null), 6000);
    return () => clearTimeout(t);
  }, [permanentToast]);

  if (permanentToast && !active) {
    const meta = SLUG_LABEL[permanentToast];
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          maxWidth: 360,
          background: 'var(--color-cream, #fdfaf3)',
          border: '1px solid var(--color-primary)',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
        }}
      >
        <div style={{ fontSize: 14, marginBottom: 8 }}>
          We'll stop suggesting <strong>{meta.friendly}</strong>. You can add it anytime from Pro Services.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPermanentToast(null)}>
            OK
          </button>
        </div>
      </div>
    );
  }

  if (!active) return null;
  const meta = SLUG_LABEL[active];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        maxWidth: 360,
        background: 'var(--color-cream, #fdfaf3)',
        border: '1px solid var(--color-primary)',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        zIndex: 1000,
      }}
    >
      <button
        type="button"
        aria-label="Dismiss add-on suggestion"
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          border: 'none',
          background: 'transparent',
          fontSize: 22,
          lineHeight: 1,
          cursor: 'pointer',
          color: 'var(--color-text-secondary, #6b6b6b)',
          padding: 4,
        }}
      >
        ×
      </button>
      <div style={{ fontWeight: 700, marginBottom: 6, paddingRight: 24 }}>Want this off your plate?</div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>
        Add <strong>{meta.name}</strong> to your Canopy plan and we'll handle it on a recurring schedule.
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>{meta.tagline}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            const slug = active;
            setActive(null);
            navigate(`/add-ons?focus=${slug}`);
          }}
        >
          See plans
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleDismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
