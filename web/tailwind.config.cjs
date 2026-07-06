module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        appBg: 'var(--color-appBg)',
        appSurface: 'var(--color-appSurface)',
        appSurfaceAlt: 'var(--color-appSurfaceAlt)',
        appBorder: 'var(--color-appBorder)',
        primary: 'var(--color-primary)',
        primaryHover: 'var(--color-primaryHover)',
        primaryTint: 'var(--color-primaryTint)',
        success: 'var(--color-success)',
        successTint: 'var(--color-successTint)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        textMain: 'var(--color-textMain)',
        textSecondary: 'var(--color-textSecondary)',
        textMuted: 'var(--color-textMuted)',
        textTertiary: 'var(--color-textTertiary)',
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
