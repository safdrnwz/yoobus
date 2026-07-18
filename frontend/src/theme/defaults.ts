import type { AppearanceSettings } from './theme.types';

/**
 * Fallback theme. The API is the source of truth; this is what paints the screen during
 * the first request and if the settings endpoint is unreachable, so the console is never
 * unstyled or blank.
 *
 * The palette is drawn from highway signage: a pine-green primary, deep navy ink, and a
 * signal amber reserved for things that need a driver's eye.
 */
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeMode: 'LIGHT',
  brandName: 'Yoo Bus',
  logoUrl: '',
  faviconUrl: '',

  primaryColor: '#0E6E56',
  secondaryColor: '#14263F',
  accentColor: '#E1A106',
  backgroundColor: '#F6F7F5',
  surfaceColor: '#FFFFFF',
  textColor: '#16211C',
  mutedTextColor: '#5F6B64',
  borderColor: '#E2E6E1',
  footerColor: '#14263F',
  footerTextColor: '#C9D2CE',
  sidebarColor: '#FFFFFF',
  sidebarTextColor: '#16211C',
  successColor: '#12805C',
  warningColor: '#B76E00',
  dangerColor: '#C0392B',
  infoColor: '#1E6FA8',

  fontFamily: "'Inter', system-ui, sans-serif",
  headingFontFamily: "'Sora', system-ui, sans-serif",
  monoFontFamily: "'JetBrains Mono', ui-monospace, monospace",
  baseFontSize: 14,
  fontScale: 1.125,
  headingWeight: 600,
  bodyWeight: 400,
  lineHeight: 1.55,
  letterSpacing: 0,

  buttonSize: 'MD',
  buttonRadius: 8,
  buttonShape: 'ROUNDED',
  buttonVariant: 'SOLID',
  buttonUppercase: false,
  buttonWeight: 500,

  radius: 10,
  density: 'COMFORTABLE',
  borderWidth: 1,
  shadowLevel: 'SUBTLE',
  sidebarWidth: 264,
  sidebarCollapsed: false,
  contentMaxWidth: 1440,

  animationsEnabled: true,
  showFooter: true,
  footerText: '© Yoo Bus Mobility. All rights reserved.',
};

/**
 * Dark preset. Selecting "Dark" swaps the surface colours; every other choice the admin
 * has made (fonts, radii, button shape, brand colours) is preserved.
 */
export const DARK_SURFACES: Partial<AppearanceSettings> = {
  backgroundColor: '#0D1411',
  surfaceColor: '#141D19',
  textColor: '#E8EDEA',
  mutedTextColor: '#94A29B',
  borderColor: '#26332C',
  sidebarColor: '#101815',
  sidebarTextColor: '#E8EDEA',
  footerColor: '#0A0F0D',
  footerTextColor: '#8C9A93',
};

/** Curated starting points, so an admin isn't forced to build a palette from nothing. */
export const THEME_PRESETS: Array<{ id: string; name: string; description: string; values: Partial<AppearanceSettings> }> = [
  {
    id: 'meridian',
    name: 'Meridian',
    description: 'Pine green and signal amber. The Yoo Bus default.',
    values: {
      themeMode: 'LIGHT',
      primaryColor: '#0E6E56',
      secondaryColor: '#14263F',
      accentColor: '#E1A106',
      backgroundColor: '#F6F7F5',
      surfaceColor: '#FFFFFF',
      textColor: '#16211C',
      mutedTextColor: '#5F6B64',
      borderColor: '#E2E6E1',
      sidebarColor: '#FFFFFF',
      sidebarTextColor: '#16211C',
      footerColor: '#14263F',
    },
  },
  {
    id: 'indigo',
    name: 'Indigo Rail',
    description: 'Cool indigo with a slate chrome. Reads well on large displays.',
    values: {
      themeMode: 'LIGHT',
      primaryColor: '#3D4EDB',
      secondaryColor: '#1B2136',
      accentColor: '#F2683C',
      backgroundColor: '#F5F6FA',
      surfaceColor: '#FFFFFF',
      textColor: '#171B29',
      mutedTextColor: '#61697F',
      borderColor: '#E3E5EE',
      sidebarColor: '#1B2136',
      sidebarTextColor: '#E6E8F2',
      footerColor: '#1B2136',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Dark console for night operations and control rooms.',
    values: {
      themeMode: 'DARK',
      primaryColor: '#3FBF8F',
      secondaryColor: '#8FA3B8',
      accentColor: '#E1A106',
      ...DARK_SURFACES,
    },
  },
  {
    id: 'crimson',
    name: 'Crimson Depot',
    description: 'High-contrast red for operators who brand around it.',
    values: {
      themeMode: 'LIGHT',
      primaryColor: '#B62D2D',
      secondaryColor: '#231A1A',
      accentColor: '#1F7A63',
      backgroundColor: '#FAF7F6',
      surfaceColor: '#FFFFFF',
      textColor: '#1E1717',
      mutedTextColor: '#6F615F',
      borderColor: '#EBE2E0',
      sidebarColor: '#FFFFFF',
      sidebarTextColor: '#1E1717',
      footerColor: '#231A1A',
    },
  },
];
