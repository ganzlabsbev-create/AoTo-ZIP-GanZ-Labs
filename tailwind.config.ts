import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#050B14",
          surface: "#0B1420",
          surface2: "#111E2E",
          border: "#1D3049",
        },
        ink: {
          DEFAULT: "#EAF3FC",
          dim: "#8FA6BE",
          faint: "#54697F",
        },
        accent: {
          indigo: "#3FA9F5",
          mint: "#34D399",
          amber: "#FBBF24",
          red: "#F87171",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl: "14px",
      },
      boxShadow: {
        "glow-indigo": "0 0 0 3px rgba(63,169,245,0.20)",
        "glow-mint": "0 0 0 3px rgba(52,211,153,0.18)",
        "glow-amber": "0 0 0 3px rgba(251,191,36,0.18)",
        "glow-red": "0 0 0 3px rgba(248,113,113,0.18)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(63,169,245,0.14), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
