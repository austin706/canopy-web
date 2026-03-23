import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Mail/Envelope icon for contact information
 */
export const MailIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

/**
 * Phone icon for contact information
 */
export const PhoneIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

/**
 * Check circle icon for completed tasks/notifications
 */
export const CheckCircleIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/**
 * Storm/Cloud with lightning icon for weather notifications
 */
export const StormIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a4 4 0 1 0-7.92.5H6a5 5 0 0 0 0 10h13z" />
    <polyline points="13 11 9 17 15 17 11 23" />
  </svg>
);

/**
 * Gear/Cog icon for equipment notifications
 */
export const GearIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m2.12-2.12l4.24-4.24M19.78 19.78l-4.24-4.24m-2.12-2.12l-4.24-4.24" />
  </svg>
);

/**
 * Wrench/Tool icon for pro service notifications
 */
export const WrenchIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 1 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

/**
 * Bell icon for general notifications
 */
export const BellIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

/**
 * Chevron down icon for expand/collapse
 */
export const ChevronDownIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * Chevron up icon for expand/collapse
 */
export const ChevronUpIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

/**
 * External link icon for opening links in new window
 */
export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/**
 * Simple check/checkmark icon
 */
export const CheckIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Sun icon for clear weather
 */
export const SunIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

/**
 * Cloud with rain icon for rainy weather
 */
export const CloudRainIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 17H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2 4 4 0 0 0 4-4 4 4 0 0 1 8 0 4 4 0 0 0 4 4 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-1" />
    <line x1="9" y1="18" x2="9" y2="20" />
    <line x1="15" y1="18" x2="15" y2="20" />
  </svg>
);

/**
 * Snowflake icon for cold/snowy weather
 */
export const SnowflakeIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 17.58a5 5 0 0 0-10-2.64 3.05 3.05 0 0 0-4.3 2.82 4.76 4.76 0 0 0 2.17 7.35" />
    <path d="M20.48 4.67A5.488 5.488 0 0 0 5.07 3.86a4.5 4.5 0 0 0 8.86 3.75A5.5 5.5 0 0 0 20.48 4.67z" />
    <path d="M3.5 11.3a5.5 5.5 0 0 1 7.42 1.73" />
  </svg>
);

/**
 * Wind icon for windy weather
 */
export const WindIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

/**
 * Thermometer icon for temperature/heat
 */
export const ThermometerIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 14.76v1.83a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-1.83m0-8.59v.01m0 4v.01m0 4v.01M12 2v4m0 4v4m0 4v4" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </svg>
);

/**
 * Alert/Warning triangle icon for severe weather alerts
 */
export const AlertTriangleIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.04h16.94a2 2 0 0 0 1.71-3.04l-8.47-14.14a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/**
 * Export all icons for convenient access
 */
export const Icons = {
  Mail: MailIcon,
  Phone: PhoneIcon,
  CheckCircle: CheckCircleIcon,
  Storm: StormIcon,
  Gear: GearIcon,
  Wrench: WrenchIcon,
  Bell: BellIcon,
  ChevronDown: ChevronDownIcon,
  ChevronUp: ChevronUpIcon,
  ExternalLink: ExternalLinkIcon,
  Check: CheckIcon,
  Sun: SunIcon,
  CloudRain: CloudRainIcon,
  Snowflake: SnowflakeIcon,
  Wind: WindIcon,
  Thermometer: ThermometerIcon,
  AlertTriangle: AlertTriangleIcon,
};
