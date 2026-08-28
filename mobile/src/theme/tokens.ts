/**
 * Carma design tokens — extracted from the "Carma Vehicle Management Design"
 * clickable prototype. Single light theme (the prototype has no dark mode).
 */

export const Colors = {
  background: '#faf9f5',
  surface: '#ffffff',
  surfaceMuted: '#F4F3ED',
  frame: '#E4E4E0',
  border: '#E7E5DC',
  text: '#141311',
  textMuted: '#6F6C63',
  textFaint: '#A6A399',
  accent: '#1F4FD8',
  accentSoft: '#E8EDFC',
  positive: '#1E8A5F',
  positiveSoft: '#E4F5EC',
  warning: '#B8770B',
  warningSoft: '#FBF0DC',
  danger: '#C4432E',
  dangerSoft: '#FBE7E2',
  white: '#ffffff',
  black: '#000000',
} as const;

// Small categorical palette reused across spend chips, category breakdowns,
// and record-type badges.
export const CategoryColors = {
  fuel: { fg: '#B8770B', bg: '#FBF0DC' },
  service: { fg: '#1F4FD8', bg: '#E8EDFC' },
  repair: { fg: '#C4432E', bg: '#FBE7E2' },
  part: { fg: '#6B4FCE', bg: '#EEE9FB' },
  insurance: { fg: '#1E8A5F', bg: '#E4F5EC' },
  loan: { fg: '#946B1F', bg: '#F3E9D6' },
  odometer: { fg: '#6F6C63', bg: '#EFEEE7' },
  other: { fg: '#6F6C63', bg: '#EFEEE7' },
} as const;

export type CategoryKey = keyof typeof CategoryColors;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const FontFamily = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semiBold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  fallback: 'System',
} as const;

// Small-caps / tracked-uppercase label voice used for step indicators,
// section headers, and meta text throughout the prototype.
export const Tracking = {
  label: 1.2,
  eyebrow: 1.5,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

export const REFERENCE_WIDTH = 390;
export const REFERENCE_HEIGHT = 844;
