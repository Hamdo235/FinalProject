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
          base:     '#0D1117',
          card:     '#161B22',
          nav:      '#0F141A',
          elevated: '#1C222B',
          border:   '#262D38',
        },
        accent: {
          sage:          '#6FB894',
          'sage-light':  '#15241C',
          amber:         '#E8C547',
          'amber-light': '#262017',
          terra:         '#D98862',
          'terra-light': '#2A1A12',
          slate:         '#6BA3C9',
          'slate-light': '#13202C',
          red:           '#D98862',
          'red-light':   '#2A1A12',
        },
        text: {
          primary:   '#E6E9EF',
          secondary: '#9BA3AF',
          muted:     '#6B7280',
          mono:      '#7FB89A',
        },
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'Inter', 'sans-serif'],
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card':       '0 8px 24px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.25)',
        'card-hover': '0 16px 40px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.30)',
        'modal':      '0 24px 70px rgba(0,0,0,0.6)',
        'input-focus':'0 0 0 3px rgba(111,184,148,0.25)',
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
