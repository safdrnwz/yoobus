/**
 * The Global Settings contract.
 *
 * These keys mirror the backend's APPEARANCE namespace exactly (see
 * common/config/platform-defaults.ts and common/logic/platform-config.util.ts). The
 * backend validates every one of them, so this type is the client half of one shared
 * schema rather than a second, drifting definition.
 */

export type ThemeMode = 'LIGHT' | 'DARK' | 'CUSTOM';
export type ButtonSize = 'SM' | 'MD' | 'LG';
export type ButtonShape = 'SQUARE' | 'ROUNDED' | 'PILL';
export type ButtonVariantToken = 'SOLID' | 'OUTLINE' | 'SOFT' | 'GHOST';
export type Density = 'COMPACT' | 'COMFORTABLE' | 'SPACIOUS';
export type ShadowLevel = 'NONE' | 'SUBTLE' | 'ELEVATED';

export interface AppearanceSettings {
  // Identity
  themeMode: ThemeMode;
  brandName: string;
  logoUrl: string;
  faviconUrl: string;

  // Palette
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  footerColor: string;
  footerTextColor: string;
  sidebarColor: string;
  sidebarTextColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  infoColor: string;

  // Typography
  fontFamily: string;
  headingFontFamily: string;
  monoFontFamily: string;
  baseFontSize: number;
  fontScale: number;
  headingWeight: number;
  bodyWeight: number;
  lineHeight: number;
  letterSpacing: number;

  // Buttons
  buttonSize: ButtonSize;
  buttonRadius: number;
  buttonShape: ButtonShape;
  buttonVariant: ButtonVariantToken;
  buttonUppercase: boolean;
  buttonWeight: number;

  // Layout
  radius: number;
  density: Density;
  borderWidth: number;
  shadowLevel: ShadowLevel;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  contentMaxWidth: number;

  // Behaviour
  animationsEnabled: boolean;
  showFooter: boolean;
  footerText: string;
}

export type AppearanceKey = keyof AppearanceSettings;

/** The shape the API accepts on PUT /appearance. */
export interface AppearancePayload {
  settings: Array<{ key: AppearanceKey; value: unknown }>;
}
