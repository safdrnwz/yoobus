/**
 * THE single source of truth for every tunable platform/global default value.
 *
 * Rule: one functionality, one place. No config literal (GST rates, seat-hold time,
 * commission, setup fee, retention, security policy, etc.) is defined anywhere else.
 * Other files import from here. The SuperAdmin Platform Configuration settings store
 * (platform-config module) overrides these at runtime; this object is the fallback.
 */
export const PLATFORM_DEFAULTS = {
  GENERAL: {
    // These four had a schema entry but no default, so GET /effective never returned them
    // and the settings screen could not render them at all — they were unreachable.
    platformName: 'Yoo Bus',
    supportEmail: 'support@yoobus.com',
    supportPhone: '18001234567',
    companyAddress: 'Yoo Bus Mobility Pvt Ltd, New Delhi, India',
    supplierStateCode: '07', // Delhi — the platform's GST registration state
  },
  LOCALIZATION: {
    defaultCurrency: 'INR',
    defaultTimezone: 'Asia/Kolkata',
    defaultLanguage: 'en-IN',
    dateFormat: 'DD/MM/YYYY',
  },
  SECURITY: {
    passwordMinLength: 8,
    sessionTimeoutMinutes: 60,
    loginRetryLimit: 5,
    lockoutMinutes: 15,
    mfaRequired: false,
    jwtExpiryMinutes: 1440,
  },
  BOOKING: {
    seatHoldMinutes: 10,
    paymentWindowMinutes: 15,
    rescheduleMinHoursBeforeDeparture: 4,
    bookingWindowDays: 120,
    cancellationWindowHours: 4,
  },
  PAYMENT: {
    defaultGstRate: 0.18,
    fareGstRate: 0.05,
    commissionGstRate: 0.18,
    tcsRate: 0.01,
    tdsRate: 0.001,
    insuranceGstRate: 0.18,
    insurancePremiumPerPassenger: 15,
    defaultCommissionRate: 0.03,
    setupFeePerBus: 4999,
    settlementCycleDays: 7,
  },
  SUBSCRIPTION: {
    graceDays: 7,
  },
  NOTIFICATION: {
    // The schema declared these three, but there was no defaults block, so the entire
    // NOTIFICATION namespace came back empty and no screen could ever show it.
    emailEnabled: true,
    smsEnabled: false,
    whatsappEnabled: false,
  },
  RETENTION: {
    auditRetentionYears: 8,
    logRetentionDays: 2190,
  },
  OTP: {
    ttlMinutes: 5,
  },
  /**
   * APPEARANCE — the global look & feel of every Yoo Bus client surface.
   * SuperAdmin-only. These values are served to the frontend (public read) and applied
   * as CSS custom properties at runtime, so the entire UI can be re-skinned without
   * a code change or redeploy.
   */
  APPEARANCE: {
    themeMode: 'LIGHT',                 // LIGHT | DARK | CUSTOM
    brandName: 'Yoo Bus',
    logoUrl: '',
    faviconUrl: '',
    // Core palette
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
    // Typography
    fontFamily: "'Inter', system-ui, sans-serif",
    headingFontFamily: "'Sora', system-ui, sans-serif",
    monoFontFamily: "'JetBrains Mono', ui-monospace, monospace",
    baseFontSize: 14,                   // px
    fontScale: 1.125,                   // modular type scale ratio
    headingWeight: 600,
    bodyWeight: 400,
    lineHeight: 1.55,
    letterSpacing: 0,                   // em
    // Buttons
    buttonSize: 'MD',                   // SM | MD | LG
    buttonRadius: 8,                    // px
    buttonShape: 'ROUNDED',             // SQUARE | ROUNDED | PILL
    buttonVariant: 'SOLID',             // SOLID | OUTLINE | SOFT | GHOST
    buttonUppercase: false,
    buttonWeight: 500,
    // Layout & surfaces
    radius: 10,                         // global corner radius (px)
    density: 'COMFORTABLE',             // COMPACT | COMFORTABLE | SPACIOUS
    borderWidth: 1,
    shadowLevel: 'SUBTLE',              // NONE | SUBTLE | ELEVATED
    sidebarWidth: 264,
    sidebarCollapsed: false,
    contentMaxWidth: 1440,
    // Behaviour
    animationsEnabled: true,
    showFooter: true,
    footerText: '© Yoo Bus Mobility. All rights reserved.',
  },
  STRUCTURAL: {
    bcryptSaltRounds: 10,
    pnrLength: 8,
  },
} as const;

// ---- Flat re-exports so existing call sites import from this single source ----
export const SEAT_HOLD_TTL_MINUTES = PLATFORM_DEFAULTS.BOOKING.seatHoldMinutes;
export const PAYMENT_WINDOW_MINUTES = PLATFORM_DEFAULTS.BOOKING.paymentWindowMinutes;
export const RESCHEDULE_MIN_HOURS_BEFORE_DEPARTURE = PLATFORM_DEFAULTS.BOOKING.rescheduleMinHoursBeforeDeparture;
export const BCRYPT_SALT_ROUNDS = PLATFORM_DEFAULTS.STRUCTURAL.bcryptSaltRounds;
export const PNR_LENGTH = PLATFORM_DEFAULTS.STRUCTURAL.pnrLength;
export const DEFAULT_SUPPLIER_STATE_CODE = PLATFORM_DEFAULTS.GENERAL.supplierStateCode;
export const DEFAULT_GST_RATE = PLATFORM_DEFAULTS.PAYMENT.defaultGstRate;
export const OTP_TTL_MS = PLATFORM_DEFAULTS.OTP.ttlMinutes * 60 * 1000;

/** Reads a default value by namespace + key (used as the settings-store fallback). */
export function platformDefault(namespace: string, key: string): unknown {
  const ns = (PLATFORM_DEFAULTS as Record<string, Record<string, unknown>>)[namespace];
  return ns ? ns[key] : undefined;
}
