import React from 'react';

interface HealthGaugeProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  backgroundColor?: string;
}

/**
 * Circular SVG gauge for home health score.
 * Colors: red (<40) → orange (40-69) → sage green (70+)
 */
export const HealthGauge: React.FC<HealthGaugeProps> = ({
  score,
  size = 120,
  strokeWidth = 10,
  backgroundColor = '#E8E2D8',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(100, Math.max(0, score));
  const offset = circumference - (normalizedScore / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 70) return '#8B9E7E';    // sage — healthy
    if (s >= 40) return '#D4A373';     // copper-light — needs attention
    return '#E53935';                    // red — critical
  };

  const getLabel = (s: number) => {
    if (s >= 90) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Needs Work';
  };

  const color = getColor(normalizedScore);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
      </svg>
      {/* Center text */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: size * 0.28, fontWeight: 700, color: '#2C2C2C', lineHeight: 1 }}>
          {normalizedScore}
        </span>
        <span style={{ fontSize: size * 0.1, fontWeight: 500, color: '#7A7A7A', marginTop: 2 }}>
          {getLabel(normalizedScore)}
        </span>
      </div>
    </div>
  );
};
