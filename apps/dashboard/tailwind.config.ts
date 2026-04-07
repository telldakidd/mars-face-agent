import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dystopian palette
        "neon-cyan": "#00ffc8",
        "neon-red": "#ff003c",
        "neon-purple": "#b833ff",
        "neon-amber": "#ffb400",
        "neon-pink": "#ff2d7b",
        "neon-green": "#00ff66",
        // Backgrounds
        "void": "#020204",
        "void-light": "#08090e",
        "dark-bg": "#020204",
        "dark-card": "#0a0c14",
        "dark-surface": "#0d0f18",
        "dark-border": "#1a1d2e",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', '"Cascadia Code"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 255, 200, 0.15), 0 0 30px rgba(0, 255, 200, 0.05)',
        'glow-red': '0 0 15px rgba(255, 0, 60, 0.15), 0 0 30px rgba(255, 0, 60, 0.05)',
        'glow-purple': '0 0 15px rgba(184, 51, 255, 0.15), 0 0 30px rgba(184, 51, 255, 0.05)',
        'glow-amber': '0 0 15px rgba(255, 180, 0, 0.15), 0 0 30px rgba(255, 180, 0, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
