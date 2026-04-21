import { CSSProperties, forwardRef, HTMLAttributes, ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'muted';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  /** When true, the card is rendered as an interactive element with hover affordance. */
  interactive?: boolean;
  style?: CSSProperties;
}

const PADDING_MAP: Record<CardPadding, string | number> = {
  none: 0,
  sm: 12,
  md: 20,
  lg: 28,
};

/**
 * Canopy's base card shell — used as the foundation for every DD-* dashboard card
 * plus commerce, pro portal, and admin UIs. Theme-aware (dark mode respected),
 * padding- and variant-configurable.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, variant = 'default', padding = 'md', interactive = false, style, ...rest },
  ref,
) {
  const { colors, resolvedMode } = useTheme();

  const base: CSSProperties = {
    borderRadius: 16,
    padding: PADDING_MAP[padding],
    background: colors.cardBackground,
    color: colors.charcoal,
    transition: interactive ? 'transform 120ms ease, box-shadow 180ms ease' : undefined,
    cursor: interactive ? 'pointer' : undefined,
  };

  const variantStyle: CSSProperties =
    variant === 'default'
      ? {
          boxShadow:
            resolvedMode === 'dark'
              ? '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }
      : variant === 'elevated'
      ? {
          boxShadow:
            resolvedMode === 'dark'
              ? '0 4px 12px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4)'
              : '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05)',
        }
      : variant === 'outlined'
      ? {
          border: `1px solid ${colors.lightGray}`,
          boxShadow: 'none',
        }
      : // muted
        {
          background: colors.cream,
          boxShadow: 'none',
        };

  return (
    <div ref={ref} style={{ ...base, ...variantStyle, ...style }} {...rest}>
      {children}
    </div>
  );
});
