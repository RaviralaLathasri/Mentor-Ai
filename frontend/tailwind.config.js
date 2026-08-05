/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0F766E",      // Teal-700
          primaryHover: "#115E59", // Teal-800
          primaryLight: "#ECFEFF", // Teal-50
          secondary: "#2563EB",    // Blue-600
          secondaryLight: "#DBEAFE", // Blue-100
          accent: "#16A34A",       // Emerald-600
          accentLight: "#DCFCE7",  // Emerald-100
          textPrimary: "#111827",  // Gray-900
          textSecondary: "#6B7280",// Gray-500
          textMuted: "#9CA3AF",    // Gray-400
          border: "#E5E7EB",       // Gray-200
          card: "#FFFFFF",
          bgMain: "#F8FAFC",       // Slate-50
          bgSecondary: "#FFFFFF",
          bgSection: "#F1F5F9",    // Slate-100
          hoverBg: "#F8FAFC",
        },
        status: {
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444",
          info: "#3B82F6",
        }
      },
      fontFamily: {
        sans: ["Inter", "Plus Jakarta Sans", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Inter", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 12px 0 rgba(0, 0, 0, 0.03), 0 1px 4px 0 rgba(0, 0, 0, 0.02)",
        softHover: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 16px -8px rgba(0, 0, 0, 0.05)",
      }
    },
  },
  plugins: [],
}
