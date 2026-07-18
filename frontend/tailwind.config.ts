import type { Config } from 'tailwindcss';

/**
 * Every colour, radius, font and spacing step below resolves to a CSS custom property
 * that ThemeProvider writes at runtime from the Global Settings API. Nothing here is a
 * literal, which is what lets a SuperAdmin re-skin the whole console without a redeploy.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
          fg: 'var(--color-primary-fg)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          soft: 'var(--color-secondary-soft)',
          fg: 'var(--color-secondary-fg)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          soft: 'var(--color-accent-soft)',
          fg: 'var(--color-accent-fg)',
        },
        canvas: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          sunken: 'var(--color-surface-sunken)',
          raised: 'var(--color-surface-raised)',
        },
        ink: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
        line: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        sidebar: {
          DEFAULT: 'var(--color-sidebar)',
          fg: 'var(--color-sidebar-fg)',
          active: 'var(--color-sidebar-active)',
        },
        footer: {
          DEFAULT: 'var(--color-footer)',
          fg: 'var(--color-footer-fg)',
        },
        success: { DEFAULT: 'var(--color-success)', soft: 'var(--color-success-soft)' },
        warning: { DEFAULT: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
        danger: { DEFAULT: 'var(--color-danger)', soft: 'var(--color-danger-soft)' },
        info: { DEFAULT: 'var(--color-info)', soft: 'var(--color-info-soft)' },
      },
      fontFamily: {
        sans: 'var(--font-body)',
        display: 'var(--font-heading)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        'step--1': 'var(--text-xs)',
        'step-0': 'var(--text-base)',
        'step-1': 'var(--text-lg)',
        'step-2': 'var(--text-xl)',
        'step-3': 'var(--text-2xl)',
        'step-4': 'var(--text-3xl)',
      },
      borderRadius: {
        control: 'var(--radius-control)',
        surface: 'var(--radius-surface)',
        pill: '999px',
      },
      borderWidth: { hair: 'var(--border-width)' },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      spacing: {
        gutter: 'var(--density-gutter)',
        row: 'var(--density-row)',
      },
      maxWidth: { content: 'var(--content-max-width)' },
      transitionDuration: { motion: 'var(--motion-duration)' },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up var(--motion-duration) ease-out both',
        'slide-in': 'slide-in var(--motion-duration) ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
