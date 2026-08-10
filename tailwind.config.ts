import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#0B0D10",
          surface: "#14171B",
          surface2: "#1B1F24",
          border: "#23272E",
        },
        ink: {
          DEFAULT: "#E7E9EC",
          dim: "#8A919C",
          faint: "#565C66",
        },
        accent: {
          indigo: "#8B7FFF",
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
        "glow-indigo": "0 0 0 3px rgba(139,127,255,0.18)",
        "glow-mint": "0 0 0 3px rgba(52,211,153,0.18)",
        "glow-amber": "0 0 0 3px rgba(251,191,36,0.18)",
        "glow-red": "0 0 0 3px rgba(248,113,113,0.18)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(139,127,255,0.10), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
