/* eslint-disable */
/**
 * GENERATED from the backend's SETTINGS_SCHEMA (common/logic/platform-config.util.ts).
 *   regenerate:  npm run api:types
 *
 * The settings screens render themselves from this. Add a setting on the server and it
 * shows up in the UI with the right control and the right validation — no screen to edit.
 */
export type SettingType =
  | 'string' | 'email' | 'timezone' | 'currency' | 'language' | 'boolean' | 'positiveInt'
  | 'rate' | 'stateCode' | 'color' | 'url' | 'text' | 'number' | 'themeMode' | 'buttonSize'
  | 'buttonShape' | 'buttonVariant' | 'density' | 'shadowLevel';

export interface SettingDef {
  key: string;
  type: SettingType;
}

export const SETTINGS_SCHEMA: Record<string, SettingDef[]> = {
  APPEARANCE: [
    { key: 'themeMode', type: 'themeMode' },
    { key: 'brandName', type: 'string' },
    { key: 'logoUrl', type: 'url' },
    { key: 'faviconUrl', type: 'url' },
    { key: 'primaryColor', type: 'color' },
    { key: 'secondaryColor', type: 'color' },
    { key: 'accentColor', type: 'color' },
    { key: 'backgroundColor', type: 'color' },
    { key: 'surfaceColor', type: 'color' },
    { key: 'textColor', type: 'color' },
    { key: 'mutedTextColor', type: 'color' },
    { key: 'borderColor', type: 'color' },
    { key: 'footerColor', type: 'color' },
    { key: 'footerTextColor', type: 'color' },
    { key: 'sidebarColor', type: 'color' },
    { key: 'sidebarTextColor', type: 'color' },
    { key: 'successColor', type: 'color' },
    { key: 'warningColor', type: 'color' },
    { key: 'dangerColor', type: 'color' },
    { key: 'infoColor', type: 'color' },
    { key: 'fontFamily', type: 'text' },
    { key: 'headingFontFamily', type: 'text' },
    { key: 'monoFontFamily', type: 'text' },
    { key: 'baseFontSize', type: 'number' },
    { key: 'fontScale', type: 'number' },
    { key: 'headingWeight', type: 'number' },
    { key: 'bodyWeight', type: 'number' },
    { key: 'lineHeight', type: 'number' },
    { key: 'letterSpacing', type: 'number' },
    { key: 'buttonSize', type: 'buttonSize' },
    { key: 'buttonRadius', type: 'number' },
    { key: 'buttonShape', type: 'buttonShape' },
    { key: 'buttonVariant', type: 'buttonVariant' },
    { key: 'buttonUppercase', type: 'boolean' },
    { key: 'buttonWeight', type: 'number' },
    { key: 'radius', type: 'number' },
    { key: 'density', type: 'density' },
    { key: 'borderWidth', type: 'number' },
    { key: 'shadowLevel', type: 'shadowLevel' },
    { key: 'sidebarWidth', type: 'number' },
    { key: 'sidebarCollapsed', type: 'boolean' },
    { key: 'contentMaxWidth', type: 'number' },
    { key: 'animationsEnabled', type: 'boolean' },
    { key: 'showFooter', type: 'boolean' },
    { key: 'footerText', type: 'text' },
  ],
  BOOKING: [
    { key: 'seatHoldMinutes', type: 'positiveInt' },
    { key: 'paymentWindowMinutes', type: 'positiveInt' },
    { key: 'rescheduleMinHoursBeforeDeparture', type: 'positiveInt' },
    { key: 'bookingWindowDays', type: 'positiveInt' },
    { key: 'cancellationWindowHours', type: 'positiveInt' },
  ],
  GENERAL: [
    { key: 'platformName', type: 'string' },
    { key: 'supportEmail', type: 'email' },
    { key: 'supportPhone', type: 'string' },
    { key: 'companyAddress', type: 'string' },
    { key: 'supplierStateCode', type: 'stateCode' },
  ],
  LOCALIZATION: [
    { key: 'defaultCurrency', type: 'currency' },
    { key: 'defaultTimezone', type: 'timezone' },
    { key: 'defaultLanguage', type: 'language' },
    { key: 'dateFormat', type: 'string' },
  ],
  NOTIFICATION: [
    { key: 'emailEnabled', type: 'boolean' },
    { key: 'smsEnabled', type: 'boolean' },
    { key: 'whatsappEnabled', type: 'boolean' },
  ],
  PAYMENT: [
    { key: 'defaultCommissionRate', type: 'rate' },
    { key: 'commissionGstRate', type: 'rate' },
    { key: 'fareGstRate', type: 'rate' },
    { key: 'insuranceGstRate', type: 'rate' },
    { key: 'insurancePremiumPerPassenger', type: 'number' },
    { key: 'setupFeePerBus', type: 'number' },
    { key: 'tdsRate', type: 'rate' },
    { key: 'tcsRate', type: 'rate' },
    { key: 'defaultGstRate', type: 'rate' },
    { key: 'settlementCycleDays', type: 'positiveInt' },
  ],
  RETENTION: [
    { key: 'auditRetentionYears', type: 'positiveInt' },
    { key: 'logRetentionDays', type: 'positiveInt' },
  ],
  SECURITY: [
    { key: 'passwordMinLength', type: 'positiveInt' },
    { key: 'sessionTimeoutMinutes', type: 'positiveInt' },
    { key: 'loginRetryLimit', type: 'positiveInt' },
    { key: 'lockoutMinutes', type: 'positiveInt' },
    { key: 'mfaRequired', type: 'boolean' },
    { key: 'jwtExpiryMinutes', type: 'positiveInt' },
  ],
};

/** Every namespace that has at least one setting. APPEARANCE has its own richer screen. */
export const SETTING_NAMESPACES = ['APPEARANCE', 'BOOKING', 'GENERAL', 'LOCALIZATION', 'NOTIFICATION', 'PAYMENT', 'RETENTION', 'SECURITY'] as const;

export type SettingNamespace = (typeof SETTING_NAMESPACES)[number];
