import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     '#FAFAF8',
          card:     '#FFFFFF',
          nav:      '#F8F7F4',
          elevated: '#F5F3EE',
          border:   '#E8E5E0',
        },
        accent: {
          sage:          '#5B8A6E',
          'sage-light':  '#EBF3EE',
          amber:         '#E8C547',
          'amber-light': '#FDF8E8',
          terra:         '#C4714A',
          'terra-light': '#FDF0E8',
          slate:         '#4A7B9D',
          'slate-light': '#EAF2F8',
          red:           '#C4714A',
          'red-light':   '#FDF0E8',
        },
        text: {
          primary:   '#1A1A1A',
          secondary: '#4A4A4A',
          muted:     '#8A8A8A',
          mono:      '#3D7A5F',
        },
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'Inter', 'sans-serif'],
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card':       '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
        'modal':      '0 20px 60px rgba(0,0,0,0.15)',
        'input-focus':'0 0 0 3px rgba(91,138,110,0.15)',
      },
      animation: {
        'fade-in':        'fadeIn 0.2s ease-out',
        'slide-up':       'slideUp 0.25s ease-out',
        'pulse-slow':     'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-badge':    'pulseBadge 2s ease-in-out infinite',
        'pulse-live':     'pulseLive 2s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'skeleton':       'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        pulseBadge: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.55' },
        },
        pulseLive: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(0.85)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(120px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
