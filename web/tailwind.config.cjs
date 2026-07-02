module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        appBg: '#F8F9FA',
        appSurface: '#FFFFFF',
        appSurfaceAlt: '#F1F3F5',
        appBorder: '#E4E7EB',
        primary: '#7C3AED',
        primaryHover: '#6D28D9',
        primaryTint: '#EDE9FE',
        success: '#059669',
        successTint: '#D1FAE5',
        warning: '#D97706',
        error: '#DC2626',
        textMain: '#111827',
        textSecondary: '#6B7280',
        textMuted: '#6B7280',
        textTertiary: '#9CA3AF',
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
      transitionDuration: {
        180: '180ms',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
