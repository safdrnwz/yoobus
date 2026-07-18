import type { AppearanceSettings, ButtonShape, Density, ShadowLevel } from './theme.types';
import { DARK_SURFACES } from './defaults';

/* ------------------------------------------------------------------ *
 * Colour maths
 *
 * The admin picks a handful of colours. Everything else a UI needs —
 * hover states, soft tints, readable foregrounds — is derived here so
 * they can never pick a combination that produces unreadable text.
 * ------------------------------------------------------------------ */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb {
  let value = hex.replace('#', '').trim();
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  if (value.length === 8) value = value.slice(0, 6);
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) return { r: 0, g: 0, b: 0 };
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: string, b: string, weight: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex({
    r: x.r + (y.r - x.r) * weight,
    g: x.g + (y.g - x.g) * weight,
    b: x.b + (y.b - x.b) * weight,
  });
}

/** Relative luminance, per WCAG. Used to decide black-or-white text on a colour. */
function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Picks whichever of near-white / near-black stays legible on the given background. */
export function readableOn(background: string): string {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#101010') ? '#FFFFFF' : '#101010';
}

function isDark(hex: string): boolean {
  return luminance(hex) < 0.4;
}

/** A colour nudged toward black (or toward white on dark themes) for hover feedback. */
function hoverOf(hex: string): string {
  return isDark(hex) ? mix(hex, '#FFFFFF', 0.14) : mix(hex, '#000000', 0.12);
}

/** A faint wash of a colour, used for badges and selected rows. */
function softOf(hex: string, surface: string): string {
  return mix(surface, hex, isDark(surface) ? 0.18 : 0.1);
}

/* ------------------------------------------------------------------ *
 * Scale tokens
 * ------------------------------------------------------------------ */

const DENSITY_SCALE: Record<Density, { gutter: string; row: string; control: string }> = {
  COMPACT: { gutter: '16px', row: '8px', control: '32px' },
  COMFORTABLE: { gutter: '24px', row: '12px', control: '38px' },
  SPACIOUS: { gutter: '32px', row: '16px', control: '44px' },
};

const SHADOWS: Record<ShadowLevel, { card: string; pop: string }> = {
  NONE: { card: 'none', pop: 'none' },
  SUBTLE: {
    card: '0 1px 2px rgba(16, 24, 20, 0.04)',
    pop: '0 8px 24px -8px rgba(16, 24, 20, 0.16)',
  },
  ELEVATED: {
    card: '0 2px 4px rgba(16, 24, 20, 0.06), 0 8px 16px -12px rgba(16, 24, 20, 0.12)',
    pop: '0 16px 48px -12px rgba(16, 24, 20, 0.26)',
  },
};

/** The button's own radius follows its shape; a free radius only applies to ROUNDED. */
function buttonRadius(shape: ButtonShape, radius: number): string {
  if (shape === 'SQUARE') return '0px';
  if (shape === 'PILL') return '999px';
  return `${radius}px`;
}

/**
 * Dark mode is a surface swap, not a different theme. The admin's brand colours, fonts,
 * radii and button choices all survive the switch — only the canvas changes.
 */
export function resolveAppearance(settings: AppearanceSettings): AppearanceSettings {
  if (settings.themeMode !== 'DARK') return settings;
  return { ...settings, ...DARK_SURFACES };
}

/**
 * Writes the whole theme to the document as CSS custom properties. Tailwind reads these,
 * so a single call here re-skins every component on screen — no re-render, no reload.
 */
export function applyAppearance(raw: AppearanceSettings, target: HTMLElement = document.documentElement): void {
  const s = resolveAppearance(raw);
  const set = (name: string, value: string) => target.style.setProperty(name, value);

  const surface = s.surfaceColor;
  const darkSurface = isDark(surface);

  // --- Colour ---
  set('--color-primary', s.primaryColor);
  set('--color-primary-hover', hoverOf(s.primaryColor));
  set('--color-primary-soft', softOf(s.primaryColor, surface));
  set('--color-primary-fg', readableOn(s.primaryColor));

  set('--color-secondary', s.secondaryColor);
  set('--color-secondary-soft', softOf(s.secondaryColor, surface));
  set('--color-secondary-fg', readableOn(s.secondaryColor));

  set('--color-accent', s.accentColor);
  set('--color-accent-soft', softOf(s.accentColor, surface));
  set('--color-accent-fg', readableOn(s.accentColor));

  set('--color-background', s.backgroundColor);
  set('--color-surface', surface);
  set('--color-surface-sunken', mix(surface, darkSurface ? '#FFFFFF' : '#000000', 0.03));
  set('--color-surface-raised', darkSurface ? mix(surface, '#FFFFFF', 0.05) : surface);

  set('--color-text', s.textColor);
  set('--color-text-muted', s.mutedTextColor);
  set('--color-text-faint', mix(s.mutedTextColor, surface, 0.4));

  set('--color-border', s.borderColor);
  set('--color-border-strong', mix(s.borderColor, s.textColor, 0.25));

  set('--color-sidebar', s.sidebarColor);
  set('--color-sidebar-fg', s.sidebarTextColor);
  set('--color-sidebar-active', softOf(s.primaryColor, s.sidebarColor));

  set('--color-footer', s.footerColor);
  set('--color-footer-fg', s.footerTextColor);

  for (const [name, colour] of [
    ['success', s.successColor],
    ['warning', s.warningColor],
    ['danger', s.dangerColor],
    ['info', s.infoColor],
  ] as const) {
    set(`--color-${name}`, colour);
    set(`--color-${name}-soft`, softOf(colour, surface));
    set(`--color-${name}-fg`, readableOn(colour));
  }

  // --- Type: one modular scale, driven by base size and ratio ---
  const base = s.baseFontSize;
  const ratio = s.fontScale;
  set('--text-xs', `${(base / ratio).toFixed(2)}px`);
  set('--text-base', `${base}px`);
  set('--text-lg', `${(base * ratio).toFixed(2)}px`);
  set('--text-xl', `${(base * ratio ** 2).toFixed(2)}px`);
  set('--text-2xl', `${(base * ratio ** 3).toFixed(2)}px`);
  set('--text-3xl', `${(base * ratio ** 4).toFixed(2)}px`);

  set('--font-body', s.fontFamily);
  set('--font-heading', s.headingFontFamily);
  set('--font-mono', s.monoFontFamily);
  set('--font-weight-body', String(s.bodyWeight));
  set('--font-weight-heading', String(s.headingWeight));
  set('--line-height', String(s.lineHeight));
  set('--letter-spacing', `${s.letterSpacing}em`);

  // --- Shape ---
  set('--radius-surface', `${s.radius}px`);
  set('--radius-control', buttonRadius(s.buttonShape, s.buttonRadius));
  set('--border-width', `${s.borderWidth}px`);

  const shadow = SHADOWS[s.shadowLevel] ?? SHADOWS.SUBTLE;
  set('--shadow-card', shadow.card);
  set('--shadow-pop', shadow.pop);

  // --- Density ---
  const density = DENSITY_SCALE[s.density] ?? DENSITY_SCALE.COMFORTABLE;
  set('--density-gutter', density.gutter);
  set('--density-row', density.row);
  set('--control-height', density.control);

  // --- Buttons ---
  const buttonHeights: Record<string, string> = { SM: '32px', MD: '38px', LG: '46px' };
  const buttonPadding: Record<string, string> = { SM: '0 12px', MD: '0 16px', LG: '0 22px' };
  set('--button-height', buttonHeights[s.buttonSize] ?? buttonHeights.MD);
  set('--button-padding', buttonPadding[s.buttonSize] ?? buttonPadding.MD);
  set('--button-weight', String(s.buttonWeight));
  set('--button-transform', s.buttonUppercase ? 'uppercase' : 'none');
  set('--button-tracking', s.buttonUppercase ? '0.04em' : 'var(--letter-spacing)');

  // --- Layout ---
  set('--sidebar-width', `${s.sidebarWidth}px`);
  set('--content-max-width', `${s.contentMaxWidth}px`);

  // Motion honours the OS setting first; the admin toggle can only ever reduce it further.
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  set('--motion-duration', s.animationsEnabled && !prefersReduced ? '160ms' : '0ms');

  // Lets components branch on the resolved theme (e.g. chart grids, code blocks).
  target.dataset.theme = darkSurface ? 'dark' : 'light';
  target.style.colorScheme = darkSurface ? 'dark' : 'light';
}

/** Swaps the favicon and tab title so the browser chrome matches the brand too. */
export function applyBrandingChrome(settings: AppearanceSettings): void {
  document.title = settings.brandName || 'Yoo Bus';
  if (!settings.faviconUrl) return;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = settings.faviconUrl;
}
