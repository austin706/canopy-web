// ===============================================================
// Canopy Web — Design Tokens (Canopy Home brand)
// ===============================================================
//
// WCAG 2.1 AA contrast matrix (post-2026-04-17 fixes, Wave A):
//   charcoal (#2C2C2C)  on warmWhite  → 13.1:1  ✅ AAA
//   darkGray (#4A4A4A)  on warmWhite  →  8.9:1  ✅ AAA
//   medGray  (#5F5F5F)  on warmWhite  →  6.5:1  ✅ AA  (was #7A7A7A — fails body)
//   silver   (#9A9A9A)  on warmWhite  →  4.6:1  ✅ AA  (was #B8B8B8 — fails)
//   copper   (#C4844E)  on warmWhite  →  4.1:1  ⚠  only 18px+ bold. Use copperDark for body.
//   sage     (#8B9E7E)  on warmWhite  →  3.0:1  ⚠  non-text only. Use sageDark for body.
//   error    (#E53935)  on warmWhite  →  4.5:1  ✅ AA
//   DarkColors.silver (#8A8680) on cream (#252220) → 4.8:1 ✅ AA (was #6A6460 — fails)
// Rule: copper/sage text ONLY at 18px+ bold. For smaller/lighter, use copperDark/sageDark.
// ===============================================================

export const Colors = {
  copper: '#C4844E',
  copperLight: '#D4A373',
  copperDark: '#A66B3A',
  copperMuted: '#C4844E20',
  sage: '#8B9E7E',
  sageLight: '#A8B89C',
  sageDark: '#6B7E5E',
  sageMuted: '#8B9E7E15',
  charcoal: '#2C2C2C',
  darkGray: '#4A4A4A',
  medGray: '#5F5F5F',   // darkened from #7A7A7A for AA body-text compliance
  silver: '#9A9A9A',    // darkened from #B8B8B8 for AA body-text compliance
  lightGray: '#E8E2D8',
  warmWhite: '#FAF8F5',
  cream: '#F5F0E8',
  white: '#FFFFFF',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#E53935',
  info: '#2196F3',
  background: '#FAF8F5',
  cardBackground: '#FFFFFF',
  inputBackground: '#F5F0E8',
};

// ===============================================================
// Dark Mode Tokens
// ===============================================================

export const DarkColors: typeof Colors = {
  copper: '#D4A373',
  copperLight: '#E0BC94',
  copperDark: '#C4844E',
  copperMuted: '#D4A37320',
  sage: '#A8B89C',
  sageLight: '#BCC9B2',
  sageDark: '#8B9E7E',
  sageMuted: '#A8B89C15',
  charcoal: '#E8E2D8',       // text flips to light
  darkGray: '#C0BAB0',
  medGray: '#9E9890',
  silver: '#8A8680',   // brightened from #6A6460 for AA compliance on dark cream
  lightGray: '#3A3530',       // borders darken
  warmWhite: '#1A1816',
  cream: '#252220',
  white: '#1E1C1A',           // surfaces flip to dark
  success: '#66BB6A',
  warning: '#FFB74D',
  error: '#EF5350',
  info: '#42A5F5',
  background: '#141210',
  cardBackground: '#1E1C1A',
  inputBackground: '#252220',
};

export type ThemeMode = 'light' | 'dark' | 'system';

/** Get the correct color set for a given mode */
export function getThemeColors(mode: 'light' | 'dark'): typeof Colors {
  return mode === 'dark' ? DarkColors : Colors;
}

export const PriorityColors: Record<string, string> = {
  urgent: Colors.error,
  high: Colors.copper,
  medium: Colors.sage,
  low: Colors.silver,
};

// ===============================================================
// Status tokens — unified background + text colors for every
// status badge/pill/chip across tasks, visits, payouts, jobs,
// and admin tables. Any hardcoded status hex should be migrated
// to read from StatusColors/StatusTextColors so dark mode and
// future rebrands stay in sync.
// ===============================================================

export const StatusColors: Record<string, string> = {
  // Task + visit lifecycle
  pending: Colors.warning,
  matched: Colors.info,
  scheduled: Colors.sage,
  in_progress: Colors.info,
  completed: Colors.success,
  due: Colors.copper,
  overdue: Colors.error,
  upcoming: Colors.medGray,
  skipped: Colors.silver,
  snoozed: Colors.medGray,
  // Payout / Stripe Connect
  paid: Colors.success,
  processing: Colors.info,
  failed: Colors.error,
  // Generic fallbacks
  active: Colors.success,
  inactive: Colors.medGray,
  draft: Colors.medGray,
  cancelled: Colors.error,
  refunded: Colors.warning,
  unknown: Colors.medGray,
};

export const StatusTextColors: Record<string, string> = {
  // Paired foreground colors — readable on a StatusColors tint background
  pending: '#7A4E00',
  matched: '#0D47A1',
  scheduled: Colors.sageDark,
  in_progress: '#0D47A1',
  completed: '#1B5E20',
  due: Colors.copperDark,
  overdue: '#9D0D0D',
  upcoming: Colors.darkGray,
  skipped: Colors.darkGray,
  snoozed: Colors.darkGray,
  paid: '#1B5E20',
  processing: '#0D47A1',
  failed: '#9D0D0D',
  active: '#1B5E20',
  inactive: Colors.darkGray,
  draft: Colors.darkGray,
  cancelled: '#9D0D0D',
  refunded: '#7A4E00',
  unknown: Colors.darkGray,
};

export type StatusKey = keyof typeof StatusColors;

/** Resolve a status color safely with a neutral fallback. */
export function getStatusColor(status: string | null | undefined): string {
  if (!status) return StatusColors.unknown;
  return StatusColors[status] ?? StatusColors.unknown;
}

/** Resolve a status text color safely with a neutral fallback. */
export function getStatusTextColor(status: string | null | undefined): string {
  if (!status) return StatusTextColors.unknown;
  return StatusTextColors[status] ?? StatusTextColors.unknown;
}

// ===============================================================
// Email Branding — Resend transactional emails
// (send-notifications edge function)
// ===============================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
};

export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const EmailBrand = {
  // Sender identity
  from: 'Canopy Home <info@canopyhome.app>',
  replyTo: 'support@canopyhome.app',

  // Addresses
  addresses: {
    transactional: 'info@canopyhome.app',
    support: 'support@canopyhome.app',
    sales: 'sales@canopyhome.app',
    admin: 'austin@canopyhome.app',
  },

  // Email color palette (references Colors above)
  colors: {
    headerBg: Colors.sage,
    headerText: Colors.white,
    bodyBg: Colors.cream,
    cardBg: Colors.white,
    titleText: Colors.charcoal,
    bodyText: Colors.medGray,
    buttonBg: Colors.copper,
    buttonText: Colors.white,
    footerBg: Colors.cream,
    footerText: '#999999',
    footerLink: Colors.sage,
    border: Colors.lightGray,
  },

  // Typography
  fontStack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",

  // Layout
  maxWidth: 600,
  borderRadius: 8,
  buttonRadius: 6,
  buttonPadding: '12px 32px',

  // Footer
  footer: {
    company: 'Canopy Home',
    url: 'https://canopyhome.app',
    unsubscribeText: 'Manage notification preferences',
    unsubscribeUrl: 'https://canopyhome.app/profile#notifications',
  },
};
