import { CSSProperties, ReactNode, useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface DashboardSectionProps {
  /** Stable identifier used for localStorage persistence of expanded state. */
  id: string;
  title: string;
  /** Short one-liner that sits under the title when collapsed. */
  summary?: string;
  /** Right-aligned badge (e.g., "3 overdue", "Setup 60%"). */
  badge?: ReactNode;
  /** Icon slot (lucide icon, emoji, SVG). */
  icon?: ReactNode;
  /** Collapsed by default? Defaults to true — DD-1 calls for collapsed rails. */
  defaultExpanded?: boolean;
  /** Force expanded/collapsed (controlled mode — skips localStorage). */
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  /** Optional deep-link shown in the header when collapsed (e.g., "Open"). */
  openHref?: string;
  onOpenHref?: () => void;
  children: ReactNode;
  style?: CSSProperties;
}

const STORAGE_PREFIX = 'canopy.dashboardSection.';

function readPersisted(id: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (raw == null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

function writePersisted(id: string, value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, value ? '1' : '0');
  } catch {
    /* quota or privacy mode — no-op */
  }
}

/**
 * Collapsible dashboard section — DD-1 progressive-disclosure primitive.
 *
 * When collapsed, shows the title + summary + badge in a single row. When
 * expanded, renders the children below the header. Remembers state per `id`
 * via localStorage so the user's preference sticks across sessions.
 */
export function DashboardSection({
  id,
  title,
  summary,
  badge,
  icon,
  defaultExpanded = false,
  expanded,
  onToggle,
  openHref,
  onOpenHref,
  children,
  style,
}: DashboardSectionProps) {
  const { colors } = useTheme();
  const isControlled = expanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState<boolean>(() =>
    readPersisted(id, defaultExpanded),
  );
  const effective = isControlled ? (expanded as boolean) : internalExpanded;

  useEffect(() => {
    if (!isControlled) writePersisted(id, internalExpanded);
  }, [id, internalExpanded, isControlled]);

  const toggle = useCallback(() => {
    const next = !effective;
    if (!isControlled) setInternalExpanded(next);
    onToggle?.(next);
  }, [effective, isControlled, onToggle]);

  const contentId = `${id}-content`;

  return (
    <section
      style={{
        borderRadius: 16,
        background: colors.cardBackground,
        boxShadow: '0 1px 2px rgba(12, 13, 16, 0.04)',
        border: `1px solid ${colors.lightGray}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={effective}
        aria-controls={contentId}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '14px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: 56,
          color: colors.charcoal,
        }}
      >
        {icon && <span style={{ flexShrink: 0, display: 'inline-flex' }}>{icon}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.charcoal }}>{title}</div>
          {summary && !effective && (
            <div
              style={{
                fontSize: 13,
                color: colors.medGray,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {summary}
            </div>
          )}
        </div>
        {badge && (
          <span style={{ flexShrink: 0, fontSize: 12, color: colors.medGray }}>{badge}</span>
        )}
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            display: 'inline-block',
            width: 18,
            transform: effective ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            color: colors.medGray,
          }}
        >
          ▾
        </span>
      </button>
      {effective && (
        <div
          id={contentId}
          style={{
            padding: '0 16px 16px',
            borderTop: `1px solid ${colors.lightGray}`,
          }}
        >
          <div style={{ paddingTop: 12 }}>{children}</div>
          {(openHref || onOpenHref) && (
            <div style={{ marginTop: 12 }}>
              {onOpenHref ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onOpenHref}
                  style={{ padding: '6px 12px' }}
                >
                  Open &rarr;
                </button>
              ) : (
                <a
                  href={openHref}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '6px 12px' }}
                >
                  Open &rarr;
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
