import { CSSProperties, ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface EmptyStateProps {
  /** Optional illustration slot — SVG, image, or lucide icon. */
  illustration?: ReactNode;
  title: string;
  description?: string;
  /** Primary CTA label + click handler. */
  primaryAction?: { label: string; onClick: () => void };
  /** Secondary CTA label + click handler. */
  secondaryAction?: { label: string; onClick: () => void };
  style?: CSSProperties;
}

/**
 * Shared empty state component — used by DD-6 Dashboard empty state, admin empty
 * lists, vault with no docs, etc. Pairs with `Card` for enclosed contexts.
 */
export function EmptyState({
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 16,
        ...style,
      }}
      role="status"
    >
      {illustration && (
        <div style={{ opacity: 0.85, marginBottom: 8, maxWidth: 180 }}>{illustration}</div>
      )}
      <h3
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          color: colors.charcoal,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: 0,
            maxWidth: 420,
            fontSize: 15,
            lineHeight: 1.6,
            color: colors.medGray,
          }}
        >
          {description}
        </p>
      )}
      {(primaryAction || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="btn btn-primary"
              style={{ minWidth: 160 }}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="btn btn-secondary"
              style={{ minWidth: 160 }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
