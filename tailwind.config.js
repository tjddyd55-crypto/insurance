/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg-main)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-card)',
        elevated: 'var(--bg-elevated)',
        soft: 'var(--bg-soft)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        border: 'var(--border-default)',
        brand: 'var(--brand-primary)',
        'on-brand': 'var(--text-on-primary)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        warning: 'var(--warning-text)',
        info: 'var(--info, #2563eb)',
      },
    },
  },
}
