// ===============================================================
// Canopy Web — Design Tokens (Oak & Sage brand)
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
  medGray: '#7A7A7A',
  silver: '#B8B8B8',
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

export const PriorityColors: Record<string, string> = {
  urgent: Colors.error,
  high: Colors.copper,
  medium: Colors.sage,
  low: Colors.silver,
};

export const StatusColors: Record<string, string> = {
  pending: Colors.warning,
  matched: Colors.info,
  scheduled: Colors.sage,
  completed: Colors.success,
  due: Colors.copper,
  overdue: Colors.error,
  upcoming: Colors.medGray,
  skipped: Colors.silver,
};
