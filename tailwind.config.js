/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B0D12",
        surface: {
          DEFAULT: "#12151C",
          hover: "#181D26",
          active: "#1E2430",
        },
        border: "#1F2430",
        accent: {
          DEFAULT: "#FF6B2C",
          hover: "#E85D20",
          light: "rgba(255, 107, 44, 0.15)",
        },
        success: {
          DEFAULT: "#22C55E",
          light: "rgba(34, 197, 94, 0.15)",
        },
        text: {
          DEFAULT: "#E6E8EE",
          muted: "#8C94A6",
          dark: "#5A6275",
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        xxs: '0.65rem',
      },
    },
  },
  plugins: [],
}
