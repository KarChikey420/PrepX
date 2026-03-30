/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-cyan': '#00f5ff',
        'dark-obsidian': '#0a192f',
        'slate-900/80': 'rgba(15, 23, 42, 0.8)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      },
      boxShadow: {
        'neon-glow': '0 0 15px rgba(0, 245, 255, 0.5)',
        'glass-border': 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      }
    },
  },
  plugins: [],
}
