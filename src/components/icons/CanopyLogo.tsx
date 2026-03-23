import React from 'react';

interface LogoProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Canopy app logo — stylized tree canopy / leaf
 * Uses the brand's sage/copper color palette
 */
export const CanopyLogo: React.FC<LogoProps> = ({ size = 32, color = '#8B9D77', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    className={className}
  >
    {/* Tree canopy — layered leaf shapes */}
    <path
      d="M24 4C16 4 10 10 10 16c0 4 2 7.5 5 10h18c3-2.5 5-6 5-10 0-6-6-12-14-12z"
      fill={color}
      opacity="0.9"
    />
    <path
      d="M24 8C18 8 13 12.5 13 17.5c0 3 1.5 5.5 4 7.5h14c2.5-2 4-4.5 4-7.5C35 12.5 30 8 24 8z"
      fill={color}
      opacity="0.6"
    />
    {/* Trunk */}
    <rect x="22" y="26" width="4" height="14" rx="2" fill="#B87333" />
    {/* Ground accent */}
    <ellipse cx="24" cy="42" rx="8" ry="2" fill={color} opacity="0.3" />
  </svg>
);

/**
 * Sidebar navigation icons — clean, minimal line icons
 */
interface NavIconProps {
  size?: number;
  color?: string;
}

const svgBase = (size: number, color: string, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const NavDashboard: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="4" rx="1" />
    <rect x="14" y="11" width="7" height="10" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </>);

export const NavCalendar: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>);

export const NavWeather: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
  </>);

export const NavEquipment: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>);

export const NavDocuments: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </>);

export const NavProServices: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </>);

export const NavLogs: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="15" y2="16" />
  </>);

export const NavNotifications: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>);

export const NavAgent: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>);

export const NavHome: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>);

export const NavSubscription: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </>);

export const NavHelp: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>);

export const NavAdmin: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>);

export const NavAgentPortal: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </>);

export const NavProPortal: React.FC<NavIconProps> = ({ size = 18, color = 'currentColor' }) =>
  svgBase(size, color, <>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </>);
