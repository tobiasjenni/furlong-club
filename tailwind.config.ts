import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        turf: { 950: "#06140f", 900: "#0b2219", 800: "#103226", 700: "#163f30", 600: "#1f5c45", 500: "#2a7a5c" },
        gold: { 300: "#f3d88a", 400: "#e9c46a", 500: "#d4a73c", 600: "#b58a26" },
        cream: "#f6f1e7",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
