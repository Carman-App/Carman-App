/**
 * Mirrors packages/shared/constants/design.ts (the web app uses the same values).
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        surface: "#F7F7F5",
        border: "#E6E6E3",
        ink: { DEFAULT: "#1C1F23", muted: "#5B6068", subtle: "#8A8F96" },
        accent: { DEFAULT: "#C2410C", hover: "#9A3412", soft: "#FFF1EA" },
        success: { DEFAULT: "#15803D", soft: "#ECFDF3" },
        warning: { DEFAULT: "#B45309", soft: "#FFFBEB" },
        danger: { DEFAULT: "#B91C1C", soft: "#FEF2F2" },
        info: { DEFAULT: "#1D4ED8", soft: "#EFF6FF" },
        whatsapp: "#1FA855",
      },
      borderRadius: { sm: "6px", md: "10px", lg: "14px", xl: "20px" },
    },
  },
  plugins: [],
};
