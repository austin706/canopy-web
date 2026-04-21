import { CSSProperties } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  style?: CSSProperties;
  /** If true, applies the shimmer animation. Defaults to true. */
  shimmer?: boolean;
}

const KEYFRAMES_ID = 'canopy-skeleton-keyframes';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes canopy-skeleton-pulse {
      0% { opacity: 0.35; }
      50% { opacity: 0.75; }
      100% { opacity: 0.35; }
    }
    @media (prefers-reduced-motion: reduce) {
      .canopy-skeleton { animation: none !important; opacity: 0.55 !important; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Generic shimmer loader. Use inside `<Card>` or grids while fetching data.
 * Honors `prefers-reduced-motion: reduce`.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  shimmer = true,
}: SkeletonProps) {
  const { colors } = useTheme();
  if (typeof document !== 'undefined') injectKeyframes();

  return (
    <div
      aria-hidden="true"
      className="canopy-skeleton"
      style={{
        width,
        height,
        borderRadius,
        background: colors.lightGray,
        animation: shimmer ? 'canopy-skeleton-pulse 1.4s ease-in-out infinite' : undefined,
        ...style,
      }}
    />
  );
}

/** Preset: single card-shaped block. */
export function SkeletonCard({
  height = 96,
  style,
}: {
  height?: number;
  style?: CSSProperties;
}) {
  return <Skeleton height={height} borderRadius={16} style={style} />;
}

/** Preset: stacked list of N card skeletons. */
export function SkeletonList({
  count = 3,
  cardHeight = 96,
  gap = 12,
}: {
  count?: number;
  cardHeight?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} height={cardHeight} />
      ))}
    </div>
  );
}
