/**
 * Carma design tokens — extracted from the "Carma App" design bundle
 * (68 screens, Google Sans, Carma blue / signal red / yellow). Single light
 * theme: the design has no dark mode.
 *
 * Naming keeps the earlier token keys (`accent`, `text`, `textMuted`, ...) so
 * every screen picks the new look up through the shared components, and adds
 * the design's own roles (`ink`, `body`, `slate`, `cta`, `signal`, ...).
 */

export const Colors = {
  // Grounds
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F3EF',
  surfaceWarm: '#F8F3E8',
  surfaceSand: '#EFE9DC',
  frame: '#E7E5E0',

  // Lines (the design draws hairlines in tinted blue or ink, never grey boxes)
  border: 'rgba(20,22,26,0.10)',
  borderSoft: 'rgba(20,22,26,0.08)',
  borderStrong: 'rgba(20,22,26,0.16)',
  line: 'rgba(19,75,156,0.16)',
  lineStrong: 'rgba(19,75,156,0.28)',

  // Ink
  ink: '#14161A',
  text: '#14161A',
  body: '#333333',
  slate: '#4A5F86',
  textMuted: '#5F5A55',
  textSubtle: '#6E6862',
  textFaint: '#A39E9D',

  // Brand
  accent: '#134B9C',
  accentPressed: '#0F3E82',
  accentSoft: '#EEF3FA',
  accentSoftPressed: '#E1EBF7',
  cta: '#F8C01D',
  ctaPressed: '#EDB81A',
  ctaSoft: '#FDF4DC',
  signal: '#DB2617',
  signalSoft: '#FDEBE9',

  // Status
  positive: '#0F7B5A',
  positiveSoft: '#E7F4EF',
  warning: '#B4551A',
  warningSoft: '#FCEFE4',
  orange: '#E2711D',
  danger: '#DB2617',
  dangerSoft: '#FDEBE9',
  teal: '#1E7F93',
  tealSoft: '#E6F2F5',
  violet: '#7A4FB5',
  violetSoft: '#F1ECF8',

  // Neutral fills
  chip: '#EDEBE7',
  chipStrong: '#DAD7D1',
  disabled: '#F2F0EB',

  white: '#FFFFFF',
  black: '#000000',
  scrim: 'rgba(19,75,156,0.40)',
} as const;

/**
 * Categorical palette reused across spend bars, category breakdowns and
 * record-type badges. The design's stacked bar reads fuel red, service blue,
 * insurance green, loan yellow, other grey.
 */
export const CategoryColors = {
  fuel: { fg: '#DB2617', bg: '#FDEBE9' },
  service: { fg: '#134B9C', bg: '#EEF3FA' },
  repair: { fg: '#E2711D', bg: '#FCEFE4' },
  part: { fg: '#7A4FB5', bg: '#F1ECF8' },
  insurance: { fg: '#0F7B5A', bg: '#E7F4EF' },
  loan: { fg: '#EDB81A', bg: '#FDF4DC' },
  odometer: { fg: '#5F5A55', bg: '#EDEBE7' },
  other: { fg: '#A39E9D', bg: '#F2F0EB' },
} as const;

export type CategoryKey = keyof typeof CategoryColors;

export const Radius = {
  xs: 4,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 34,
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

/** Control heights from the design: 64 primary pills, 52 secondary, 45 icon buttons. */
export const Size = {
  cta: 64,
  control: 52,
  field: 52,
  iconButton: 45,
  avatar: 40,
} as const;

export const FontFamily = {
  regular: 'GoogleSans_400Regular',
  medium: 'GoogleSans_500Medium',
  semiBold: 'GoogleSans_600SemiBold',
  bold: 'GoogleSans_700Bold',
  fallback: 'System',
} as const;

// Tracked-uppercase label voice used for step indicators, section headers
// and meta text throughout the design (letter-spacing .14em – .28em).
export const Tracking = {
  label: 1.4,
  eyebrow: 1.8,
  brand: 2.8,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#14161A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#14161A',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

export const REFERENCE_WIDTH = 390;
export const REFERENCE_HEIGHT = 844;

/**
 * Tablets and large phones: the design is a phone layout, so on wide screens
 * the app sits in a centred column of at most this width (sheets too).
 */
export const Layout = {
  maxWidth: 640,
} as const;
