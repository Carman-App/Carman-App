/**
 * Carma design tokens — extracted from the "Carma Vehicle Management Design"
 * clickable prototype. Single light theme (the prototype has no dark mode).
 *
 * Values below were re-verified against the prototype source directly (hex
 * frequency count + surrounding markup/JS for each color), not eyeballed.
 * Notable corrections from the previous pass:
 *  - `text` was near-black (#141311); the prototype's actual ink is #333/
 *    #333333 (800+ uses), a medium-dark gray, not near-black.
 *  - `textMuted`/`textFaint` were close approximations; corrected to the
 *    exact values (#6E6E68, #9A9A94).
 *  - `border` was an invented solid color (#E7E5DC never appears in the
 *    prototype); real dividers are semi-transparent black
 *    (`rgba(51,51,51,…)`) at two alpha levels.
 *  - `danger` was pointed at an invented red (#C4432E); the prototype's
 *    actual broad alert/urgent color is #FE4A49. A second, narrower red
 *    (#C4302B) is reserved for inline validation-error text and the
 *    "OVERDUE" badge — see `error` below.
 *  - `positive`/`positiveSoft` were removed: the prototype has no
 *    success/green color anywhere (confirmed by full hex-frequency scan of
 *    the source, and by inspecting the "record saved" checkmark screen and
 *    the inspection-report "GOOD" tier, both of which render with
 *    `var(--acc,#1F4FD8)` — accent blue, not green — despite an internal
 *    variable literally named `inspGreenFlex`). "Good/positive" states use
 *    `accent`/`accentSoft` throughout the design.
 *  - `warning`/`warningSoft` were pointed at invented values; the real
 *    "attention" tier color is #F97316 (soft: #FEF1E7) — used for
 *    documents expiring soon, mid-tier trial countdown, and mid-tier
 *    overdue invoices.
 */

export const Colors = {
  background: '#faf9f5',
  surface: '#ffffff',
  // Light neutral used for info banners and the "selected" row/segment
  // highlight (was #F4F3ED, an approximation of the prototype's #F3F3F0).
  surfaceMuted: '#F3F3F0',
  // Outer page background behind the phone frame in the prototype. Not
  // currently consumed anywhere in the RN app; kept for parity.
  frame: '#E4E4E0',
  // Primary structural border — section/card outlines and border-top
  // dividers. The prototype has no literal `#E7E5DC`; this role is really
  // semi-transparent black. `.16` alpha is the dominant weight for
  // section-level dividers, outlines, and the tab bar's top border.
  border: 'rgba(51,51,51,0.16)',
  // Lighter alpha used specifically for repeating list-row separators
  // (the divider between rows inside one section/card).
  borderLight: 'rgba(51,51,51,0.1)',
  // Primary text/icon ink (also the "CARMA" wordmark color). 800+ uses as
  // `#333`/`#333333` in the prototype — a medium-dark gray, not near-black.
  text: '#333333',
  // Secondary muted text — meta lines, section labels, currency prefixes.
  textMuted: '#6E6E68',
  // Third, lighter gray reserved for small tracked-letter-spacing labels
  // (eyebrow text, unfocused tab bar icons/labels) — distinct from
  // `disabled` below, which is used for inactive/disabled content instead.
  textFaint: '#9A9A94',
  // Input placeholder text specifically (`input::placeholder { color:
  // #CFCFCA }` in the prototype) — lighter than `textFaint`.
  placeholder: '#CFCFCA',
  // Disabled/inactive icons, chevrons, and zeroed-out amounts.
  disabled: '#C9C9C4',
  // Inactive toggle track, unfilled progress-bar segment, and (by
  // extension) the bottom-sheet drag handle.
  disabledTrack: '#D6D6D1',
  accent: '#1F4FD8',
  accentSoft: '#EEF2FD',
  // Mid-tier "attention" color — documents expiring soon, mid-tier trial
  // countdown, mid-tier overdue invoices, imbalanced team load.
  warning: '#F97316',
  warningSoft: '#FEF1E7',
  // Broad urgent/alert/destructive color — overdue services & invoices,
  // over-budget variance, delete/urgent markers, notification icons.
  danger: '#FE4A49',
  dangerSoft: '#FDECEC',
  // Narrower, more saturated red reserved for inline validation-error text
  // (e.g. "You must add at least one line") and the "OVERDUE" status badge
  // — kept distinct from `danger` because the prototype itself keeps them
  // distinct in these exact spots (`dpBad ? "#C4302B" : "#333"`, and the
  // OVERDUE bar+label component).
  error: '#C4302B',
  // Gold "in progress" status ink — confirmed live on the build-stage detail
  // screen's "IN PROGRESS" header badge (done tier = `accent`, not-started
  // tier = `textFaint`). Also the fill for progress-bar-shaped bar/dot
  // segments (build-stage list row, over-budget-within-contingency,
  // stalled-build indicator dot) — none of which the app currently renders
  // as a distinct element, so `progress` has exactly one live consumer
  // today. NOTE: "AWAITING YOUR APPROVAL"-style copy is NOT this color in
  // the prototype — it's `accent` on the estimate screen (solid blue pill)
  // and `textFaint` on the vehicle-QR access-request row; verified by
  // rendering both and reading computed color, since the two look
  // superficially like the same "pending" concept but are not.
  progress: '#F2C200',
  white: '#ffffff',
  black: '#000000',
} as const;

// Small categorical palette reused across spend chips, category breakdowns,
// and record-type badges. NOTE: the prototype itself does not color-code
// record types at all — its timeline rows render every icon in the same
// neutral `textMuted`, and its own "add expense" category list only ever
// toggles between `accent` (selected) and `textMuted` (unselected). This
// palette is therefore an app-level addition with no prototype ground
// truth. Where a category clearly mirrored one of the old (wrong) base
// tokens it has been corrected to the new value; the three categories that
// need a genuinely distinct hue for legibility (insurance, loan, part) keep
// their existing invented colors since collapsing them onto `accent` would
// make same-screen categories indistinguishable — see report for detail.
export const CategoryColors = {
  fuel: { fg: '#F97316', bg: '#FEF1E7' },
  service: { fg: '#1F4FD8', bg: '#EEF2FD' },
  repair: { fg: '#FE4A49', bg: '#FDECEC' },
  part: { fg: '#6B4FCE', bg: '#EEE9FB' },
  insurance: { fg: '#1E8A5F', bg: '#E4F5EC' },
  loan: { fg: '#946B1F', bg: '#F3E9D6' },
  odometer: { fg: '#6E6E68', bg: '#F3F3F0' },
  other: { fg: '#6E6E68', bg: '#F3F3F0' },
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
