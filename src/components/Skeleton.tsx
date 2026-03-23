import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'title' | 'avatar' | 'bar' | 'card';
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ variant = 'text', width, height, count = 1, className = '' }) => {
  const items = Array.from({ length: count });

  if (variant === 'card') {
    return (
      <>
        {items.map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-row">
              <div className="skeleton skeleton-avatar" />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-text short" />
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  const variantClass = variant === 'text' ? 'skeleton-text'
    : variant === 'title' ? 'skeleton-title'
    : variant === 'avatar' ? 'skeleton-avatar'
    : 'skeleton-bar';

  return (
    <>
      {items.map((_, i) => (
        <div
          key={i}
          className={`skeleton ${variantClass} ${className}`}
          style={{ ...(width ? { width } : {}), ...(height ? { height } : {}) }}
        />
      ))}
    </>
  );
};

/**
 * Full-page skeleton for loading states — replaces "Loading..." text
 */
export const PageSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="page" style={{ animation: 'none' }}>
    <div style={{ marginBottom: 24 }}>
      <Skeleton variant="title" width="30%" />
      <Skeleton variant="text" width="50%" />
    </div>
    <Skeleton variant="card" count={rows} />
  </div>
);
