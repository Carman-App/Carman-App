/**
 * Design tokens shared by the web (Tailwind) and mobile (NativeWind) apps.
 *
 * Accent is a signal orange: it carries prices and primary actions and stays
 * clearly distinct from WhatsApp green, which is reserved for WhatsApp buttons.
 * `accent` on white is 5.2:1 (WCAG AA for normal text).
 */
export const colors = {
  background: "#FFFFFF",
  surface: "#F7F7F5",
  border: "#E6E6E3",
  ink: "#1C1F23",
  inkMuted: "#5B6068",
  inkSubtle: "#8A8F96",
  accent: "#C2410C",
  accentHover: "#9A3412",
  accentSoft: "#FFF1EA",
  success: "#15803D",
  warning: "#B45309",
  danger: "#B91C1C",
  info: "#1D4ED8",
  whatsapp: "#1FA855",
  verified: "#1D4ED8",
} as const;

export const radii = { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;

/** Satoshi is self-hosted from Fontshare (ITF FFL); the stack falls back cleanly. */
export const fontFamily = {
  sans: ["Satoshi", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
} as const;
