import React from 'react';
import { Colors } from '@/constants/theme';

interface AgentAvatarProps {
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string;
  style?: React.CSSProperties;
}

const SIZES = {
  sm: { width: 40, height: 40, fontSize: 14 },
  md: { width: 64, height: 64, fontSize: 20 },
  lg: { width: 96, height: 96, fontSize: 32 },
};

export function AgentAvatar({
  name,
  photoUrl,
  size = 'md',
  accentColor = Colors.copper,
  style,
}: AgentAvatarProps) {
  const sizeStyles = SIZES[size];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: sizeStyles.width,
          height: sizeStyles.height,
          borderRadius: '50%',
          objectFit: 'cover',
          objectPosition: 'center',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: sizeStyles.width,
        height: sizeStyles.height,
        borderRadius: '50%',
        background: accentColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: Colors.white,
        fontSize: sizeStyles.fontSize,
        fontWeight: 700,
        ...style,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
