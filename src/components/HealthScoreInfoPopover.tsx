import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

interface HealthScoreInfoPopoverProps {
  /** Numeric score to display inline, if available. */
  score?: number;
  /** Optional label for the trigger button (a11y). Defaults to a generic question prompt. */
  triggerLabel?: string;
  /** Override the deep-link target for the "How to improve" CTA. */
  improveHref?: string;
}

/**
 * DD-3: Home Health Score explainer popover.
 *
 * Replaces the old `title` tooltip on the Dashboard health card. Opens on
 * click or focus (keyboard-accessible). Closes on outside click or Escape.
 * Primary CTA deep-links to `/health-score` (or the provided href) for the
 * full ranked drill-down of top improvement actions.
 */
export function HealthScoreInfoPopover({
  score,
  triggerLabel = 'What is the Home Health Score?',
  improveHref = '/health-score',
}: HealthScoreInfoPopoverProps) {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        style={{
          background: 'none',
          border: `1px solid ${colors.medGray}40`,
          borderRadius: '50%',
          width: 18,
          height: 18,
          fontSize: 11,
          fontWeight: 700,
          color: colors.medGray,
          cursor: 'pointer',
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        i
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Home Health Score explainer"
          style={{
            position: 'absolute',
            top: 26,
            left: 0,
            zIndex: 50,
            minWidth: 280,
            maxWidth: 340,
            background: colors.cardBackground,
            border: `1px solid ${colors.lightGray}`,
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(12, 13, 16, 0.12)',
            padding: 16,
            textAlign: 'left',
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: colors.charcoal,
              marginBottom: 8,
            }}
          >
            How we calculate your score
            {score !== undefined && (
              <span style={{ color: colors.medGray, fontWeight: 500, marginLeft: 6 }}>
                ({score}/100)
              </span>
            )}
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              color: colors.darkGray,
              lineHeight: 1.55,
            }}
          >
            <li>Overdue task count (heaviest weight)</li>
            <li>Equipment age vs. expected lifespan</li>
            <li>Inspections in the last 12 months</li>
            <li>Document vault completeness</li>
          </ul>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 12,
              color: colors.medGray,
              lineHeight: 1.5,
            }}
          >
            Clear overdue items and finish this month's tasks to stay 70+.
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(improveHref);
            }}
            className="btn btn-primary btn-sm"
            style={{
              marginTop: 12,
              width: '100%',
              minHeight: 36,
              fontWeight: 600,
            }}
          >
            How to improve →
          </button>
        </div>
      )}
    </div>
  );
}
