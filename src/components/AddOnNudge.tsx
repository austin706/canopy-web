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
// Suppression: per-category dismissal is persisted to localStorage so
// the same nudge doesn't reappear in the same session if the user
// already said no. We also suppress entirely if the user already has an
// active subscription to that add-on (caller's responsibility — pass
// the active slugs in via setActiveAddOnSlugs).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type AddOnSlug = 'pest_control' | 'lawn' | 'pool' | 'septic' | 'cleaning';

const CATEGORY_TO_SLUG: Record<string, AddOnSlug> = {
  pest_control: 'pest_control',
  lawn: 'lawn',
  sprinkler: 'lawn',
  pool: 'pool',
  septic: 'septic',
  cleaning: 'cleaning',
};

const SLUG_LABEL: Record<AddOnSlug, { name: string; tagline: string }> = {
  pest_control: { name: 'Pest Shield',   tagline: 'Quarterly treatments + free re-services. Tulsa Certified Pros.' },
  lawn:         { name: 'Lawn Care',     tagline: 'Mow, edge, fertilize — bi-weekly schedule built around your yard.' },
  pool:         { name: 'Pool Service',  tagline: 'Weekly chemistry, cleaning, and equipment checks.' },
  septic:       { name: 'Septic Care',   tagline: 'Inspections, pumping reminders, and on-call response.' },
  cleaning:     { name: 'House Cleaning',tagline: 'Bi-weekly deep clean, scoped to your home size.' },
};

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

const dismissKey = (uid: string, slug: AddOnSlug) => `canopy.addon.nudge.dismissed.${uid}.${slug}`;

export default function AddOnNudge({ activeAddOnSlugs = [] }: Props) {
  const navigate = useNavigate();
  const [active, setActive] = useState<AddOnSlug | null>(null);

  useEffect(() => {
    const fn: Listener = (slug) => {
      if (activeAddOnSlugs.includes(slug)) return;
      // Per-user-per-slug dismissal lives in localStorage. We don't have
      // the user id here without lifting state — fall back to a per-slug
      // session-level suppression via sessionStorage.
      const sessionKey = `canopy.addon.nudge.shown.${slug}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');
      setActive(slug);
    };
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, [activeAddOnSlugs]);

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
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Want this off your plate?</div>
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
          onClick={() => setActive(null)}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
