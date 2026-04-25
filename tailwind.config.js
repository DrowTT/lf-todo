/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'lf-bg': {
          deep: '#f0f4fa',
          primary: '#fefefe',
          sidebar: '#e8edf5',
          hover: '#dde5f2'
        },
        'lf-text': {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8'
        },
        'lf-accent': {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          strong: '#1e40af'
        },
        'lf-state': {
          success: '#16a34a',
          danger: '#dc2626',
          warning: '#d97706',
          pomodoro: '#f97316'
        }
      },
      fontSize: {
        'lf-xs': '11px',
        'lf-sm': '12px',
        'lf-md': '13px',
        'lf-lg': '14px',
        'lf-xl': '16px',
        'lf-2xl': '20px'
      },
      borderRadius: {
        'lf-sm': '4px',
        'lf-md': '8px',
        'lf-lg': '12px',
        'lf-xl': '16px'
      },
      boxShadow: {
        'lf-card': '0 1px 3px rgba(15, 23, 42, 0.06), 0 6px 16px rgba(15, 23, 42, 0.04)',
        'lf-card-hover': '0 2px 6px rgba(15, 23, 42, 0.08), 0 8px 20px rgba(15, 23, 42, 0.06)',
        'lf-popover': '0 18px 48px rgba(15, 23, 42, 0.16)'
      },
      zIndex: {
        sticky: '20',
        dropdown: '260',
        context: '420',
        modal: '700',
        toast: '900'
      }
    }
  },
  plugins: []
}
