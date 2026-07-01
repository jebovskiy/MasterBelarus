/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg': '#F8F9FA',
        'app-surface': '#FFFFFF',
        'app-surface-alt': '#F1F3F5',
        'app-border': '#E4E7EB',
        primary: {
          DEFAULT: '#7C3AED',
          hover: '#6D28D9',
          tint: '#EDE9FE',
        },
        success: {
          DEFAULT: '#059669',
          tint: '#D1FAE5',
        },
        warning: {
          DEFAULT: '#D97706',
        },
        error: {
          DEFAULT: '#DC2626',
        },
        'text-main': '#111827',
        'text-muted': '#6B7280',
        'text-tertiary': '#9CA3AF',
      },
      borderRadius: {
        bento: '16px',
        btn: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(17,24,39,0.04), 0 1px 3px rgba(17,24,39,0.06)',
        'card-hover': '0 4px 6px -1px rgba(17,24,39,0.07), 0 2px 4px -2px rgba(17,24,39,0.05)',
        modal: '0 24px 48px -12px rgba(17,24,39,0.18)',
        'accent-glow': '0 0 24px rgba(125,58,237,0.25)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
