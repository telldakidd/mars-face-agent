/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'neon-cyan': '#00e5ff',
        'neon-purple': '#b388ff',
        'dark-bg': '#05060a',
        'dark-card': '#0d1117',
        'dark-border': '#1a1f2e',
        'dark-surface': '#161b22',
        'muted': '#8b949e',
        'success': '#2ea043',
        'danger': '#f85149',
        'warning': '#d29922',
      },
    },
  },
  plugins: [],
};
