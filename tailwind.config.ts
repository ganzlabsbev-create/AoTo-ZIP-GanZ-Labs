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
    },
  },
  plugins: [],
};

export default config;
