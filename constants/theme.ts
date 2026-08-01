export const Colors = {
  // Primary — forest green, used with restraint
  primary: '#006B2F',
  primaryDark: '#005323',
  primaryLight: '#E8F5E9',
  primaryContainer: '#00873D',
  primaryFixed: '#7EFC9A',
  primaryFixedDim: '#60DF81',
  onPrimaryContainer: '#FFFFFF',

  // Secondary — warm orange, the app's personality
  accent: '#FD8100',
  accentLight: '#FFF3E0',
  accentContainer: '#954A00',
  onAccent: '#FFFFFF',

  // Surfaces — 6-level elevation system
  background: '#F9F9FC',
  surface: '#F9F9FC',
  surfaceDim: '#DADADC',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F3F3F6',
  surfaceContainer: '#EEEEF0',
  surfaceContainerHigh: '#E8E8EA',
  surfaceContainerHighest: '#E2E2E5',
  surfaceCard: '#FFFFFF',

  // Text
  text: '#1A1C1E',
  textSecondary: '#3E4A3E',
  textMuted: '#6D7A6D',
  textOnDark: '#FFFFFF',

  // Borders
  border: '#BDCABA',
  borderLight: '#E2E2E5',
  outline: '#6D7A6D',
  outlineVariant: '#BDCABA',

  // Status
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  warning: '#F39C12',
  success: '#006B2F',

  // Utility
  shadow: '#000',
  overlay: 'rgba(0,0,0,0.5)',
  scrim: 'rgba(0,0,0,0.32)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

// Material Design 3 type scale
export const TypeScale = {
  displayLg: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  headlineMd: { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.2 },
  titleLg: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  titleSm: { fontSize: 18, fontWeight: '600' as const },
  bodyLg: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMd: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  labelLg: { fontSize: 14, fontWeight: '600' as const },
  labelMd: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  labelSm: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};
