/**
 * Pure, testable rules for the SuperAdmin Platform Configuration module.
 * This module owns global SETTINGS VALUES, FEATURE FLAGS, and CONFIG VERSION history.
 * It deliberately does not re-implement maintenance scheduling (MaintenanceModule) or
 * the immutable audit trail (AuditModule) — those already exist and are referenced, not duplicated.
 */
export type SettingNamespace = 'GENERAL' | 'LOCALIZATION' | 'SECURITY' | 'BOOKING' | 'PAYMENT' | 'NOTIFICATION' | 'RETENTION' | 'APPEARANCE';

export const SETTING_NAMESPACES: SettingNamespace[] = ['GENERAL', 'LOCALIZATION', 'SECURITY', 'BOOKING', 'PAYMENT', 'NOTIFICATION', 'RETENTION', 'APPEARANCE'];
export type SettingType =
  | 'string' | 'email' | 'timezone' | 'currency' | 'language' | 'boolean' | 'positiveInt' | 'rate' | 'stateCode'
  // Appearance types
  | 'color' | 'url' | 'text' | 'number' | 'themeMode' | 'buttonSize' | 'buttonShape' | 'buttonVariant' | 'density' | 'shadowLevel';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

/** The controlled schema of known settings. Unknown keys are rejected to prevent typos. */
export const SETTINGS_SCHEMA: Record<string, SettingType> = {
  'GENERAL.platformName': 'string',
  'GENERAL.supportEmail': 'email',
  'GENERAL.supportPhone': 'string',
  'GENERAL.companyAddress': 'string',
  'GENERAL.supplierStateCode': 'stateCode',
  'LOCALIZATION.defaultCurrency': 'currency',
  'LOCALIZATION.defaultTimezone': 'timezone',
  'LOCALIZATION.defaultLanguage': 'language',
  'LOCALIZATION.dateFormat': 'string',
  'SECURITY.passwordMinLength': 'positiveInt',
  'SECURITY.sessionTimeoutMinutes': 'positiveInt',
  'SECURITY.loginRetryLimit': 'positiveInt',
  'SECURITY.lockoutMinutes': 'positiveInt',
  'SECURITY.mfaRequired': 'boolean',
  'SECURITY.jwtExpiryMinutes': 'positiveInt',
  'BOOKING.seatHoldMinutes': 'positiveInt',
  // These two had a default and were shown in the UI, but were missing from the schema —
  // so editing them and pressing Save came back 400 CONFIG_UNKNOWN_KEY.
  'BOOKING.paymentWindowMinutes': 'positiveInt',
  'BOOKING.rescheduleMinHoursBeforeDeparture': 'positiveInt',
  'BOOKING.bookingWindowDays': 'positiveInt',
  'BOOKING.cancellationWindowHours': 'positiveInt',
  // Every one of these had a default but no schema entry, so the money settings —
  // commission, GST, TDS/TCS, insurance, setup fee — were visible and unsaveable.
  'PAYMENT.defaultCommissionRate': 'rate',
  'PAYMENT.commissionGstRate': 'rate',
  'PAYMENT.fareGstRate': 'rate',
  'PAYMENT.insuranceGstRate': 'rate',
  'PAYMENT.insurancePremiumPerPassenger': 'number',
  'PAYMENT.setupFeePerBus': 'number',
  'PAYMENT.tdsRate': 'rate',
  'PAYMENT.tcsRate': 'rate',
  'PAYMENT.defaultGstRate': 'rate',
  'PAYMENT.settlementCycleDays': 'positiveInt',
  'NOTIFICATION.emailEnabled': 'boolean',
  'NOTIFICATION.smsEnabled': 'boolean',
  'NOTIFICATION.whatsappEnabled': 'boolean',
  'RETENTION.auditRetentionYears': 'positiveInt',
  'RETENTION.logRetentionDays': 'positiveInt',

  // ---- APPEARANCE (Global Settings — SuperAdmin only) ----
  // Identity
  'APPEARANCE.themeMode': 'themeMode',
  'APPEARANCE.brandName': 'string',
  'APPEARANCE.logoUrl': 'url',
  'APPEARANCE.faviconUrl': 'url',
  // Palette
  'APPEARANCE.primaryColor': 'color',
  'APPEARANCE.secondaryColor': 'color',
  'APPEARANCE.accentColor': 'color',
  'APPEARANCE.backgroundColor': 'color',
  'APPEARANCE.surfaceColor': 'color',
  'APPEARANCE.textColor': 'color',
  'APPEARANCE.mutedTextColor': 'color',
  'APPEARANCE.borderColor': 'color',
  'APPEARANCE.footerColor': 'color',
  'APPEARANCE.footerTextColor': 'color',
  'APPEARANCE.sidebarColor': 'color',
  'APPEARANCE.sidebarTextColor': 'color',
  'APPEARANCE.successColor': 'color',
  'APPEARANCE.warningColor': 'color',
  'APPEARANCE.dangerColor': 'color',
  'APPEARANCE.infoColor': 'color',
  // Typography
  'APPEARANCE.fontFamily': 'text',
  'APPEARANCE.headingFontFamily': 'text',
  'APPEARANCE.monoFontFamily': 'text',
  'APPEARANCE.baseFontSize': 'number',
  'APPEARANCE.fontScale': 'number',
  'APPEARANCE.headingWeight': 'number',
  'APPEARANCE.bodyWeight': 'number',
  'APPEARANCE.lineHeight': 'number',
  'APPEARANCE.letterSpacing': 'number',
  // Buttons
  'APPEARANCE.buttonSize': 'buttonSize',
  'APPEARANCE.buttonRadius': 'number',
  'APPEARANCE.buttonShape': 'buttonShape',
  'APPEARANCE.buttonVariant': 'buttonVariant',
  'APPEARANCE.buttonUppercase': 'boolean',
  'APPEARANCE.buttonWeight': 'number',
  // Layout
  'APPEARANCE.radius': 'number',
  'APPEARANCE.density': 'density',
  'APPEARANCE.borderWidth': 'number',
  'APPEARANCE.shadowLevel': 'shadowLevel',
  'APPEARANCE.sidebarWidth': 'number',
  'APPEARANCE.sidebarCollapsed': 'boolean',
  'APPEARANCE.contentMaxWidth': 'number',
  // Behaviour
  'APPEARANCE.animationsEnabled': 'boolean',
  'APPEARANCE.showFooter': 'boolean',
  'APPEARANCE.footerText': 'text',
};

/** Allowed values for the enumerated appearance settings. */
export const APPEARANCE_ENUMS: Record<string, readonly string[]> = {
  themeMode: ['LIGHT', 'DARK', 'CUSTOM'],
  buttonSize: ['SM', 'MD', 'LG'],
  buttonShape: ['SQUARE', 'ROUNDED', 'PILL'],
  buttonVariant: ['SOLID', 'OUTLINE', 'SOFT', 'GHOST'],
  density: ['COMPACT', 'COMFORTABLE', 'SPACIOUS'],
  shadowLevel: ['NONE', 'SUBTLE', 'ELEVATED'],
};

/** Accepts #rgb, #rrggbb and #rrggbbaa. */
export function isValidColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

/** An empty string clears the asset; otherwise it must be an http(s) or data URL. */
export function isValidUrl(value: string): boolean {
  if (value === '') return true;
  return /^(https?:\/\/|data:image\/)[^\s]+$/.test(value);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function isValidCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}
export function isValidLanguage(value: string): boolean {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(value);
}
export function isValidTimezone(value: string): boolean {
  return value === 'UTC' || /^[A-Za-z]+\/[A-Za-z_]+$/.test(value);
}
export function isValidStateCode(value: string): boolean {
  return /^[0-9]{2}$/.test(value);
}

/** Validates a setting value against the controlled schema. */
export function validateSetting(namespace: string, key: string, value: unknown): InvariantResult {
  const fullKey = `${namespace}.${key}`;
  const type = SETTINGS_SCHEMA[fullKey];
  if (!type) {
    return { ok: false, code: 'CONFIG_UNKNOWN_KEY', message: `Unknown setting "${fullKey}".` };
  }
  switch (type) {
    case 'string':
      if (typeof value !== 'string' || value.trim() === '') return fail('CONFIG_INVALID_STRING', `"${fullKey}" must be a non-empty string.`);
      break;
    case 'email':
      if (typeof value !== 'string' || !isValidEmail(value)) return fail('CONFIG_INVALID_EMAIL', `"${fullKey}" must be a valid email.`);
      break;
    case 'currency':
      if (typeof value !== 'string' || !isValidCurrency(value)) return fail('CONFIG_INVALID_CURRENCY', `"${fullKey}" must be a 3-letter currency code.`);
      break;
    case 'language':
      if (typeof value !== 'string' || !isValidLanguage(value)) return fail('CONFIG_INVALID_LANGUAGE', `"${fullKey}" must be a language code like "en" or "en-IN".`);
      break;
    case 'timezone':
      if (typeof value !== 'string' || !isValidTimezone(value)) return fail('CONFIG_INVALID_TIMEZONE', `"${fullKey}" must be a valid timezone.`);
      break;
    case 'stateCode':
      if (typeof value !== 'string' || !isValidStateCode(value)) return fail('CONFIG_INVALID_STATE_CODE', `"${fullKey}" must be a 2-digit state code.`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return fail('CONFIG_INVALID_BOOLEAN', `"${fullKey}" must be true or false.`);
      break;
    case 'positiveInt':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return fail('CONFIG_INVALID_NUMBER', `"${fullKey}" must be a whole number of zero or more.`);
      break;
    case 'rate':
      if (typeof value !== 'number' || value < 0 || value > 1) return fail('CONFIG_INVALID_RATE', `"${fullKey}" must be a rate between 0 and 1.`);
      break;
    case 'color':
      if (typeof value !== 'string' || !isValidColor(value)) return fail('CONFIG_INVALID_COLOR', `"${fullKey}" must be a hex colour such as #0E6E56.`);
      break;
    case 'url':
      if (typeof value !== 'string' || !isValidUrl(value)) return fail('CONFIG_INVALID_URL', `"${fullKey}" must be an http(s) or data URL, or empty to clear it.`);
      break;
    case 'text':
      if (typeof value !== 'string') return fail('CONFIG_INVALID_STRING', `"${fullKey}" must be text.`);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fail('CONFIG_INVALID_NUMBER', `"${fullKey}" must be a number of zero or more.`);
      break;
    case 'themeMode':
    case 'buttonSize':
    case 'buttonShape':
    case 'buttonVariant':
    case 'density':
    case 'shadowLevel': {
      const allowed = APPEARANCE_ENUMS[type];
      if (typeof value !== 'string' || !allowed.includes(value)) {
        return fail('CONFIG_INVALID_ENUM', `"${fullKey}" must be one of: ${allowed.join(', ')}.`);
      }
      break;
    }
  }
  return { ok: true };
}

function fail(code: string, message: string): InvariantResult {
  return { ok: false, code, message };
}

// ---- Feature flags ----
export interface FeatureFlagState {
  enabledGlobally: boolean;
  scheduledAt?: number | null; // epoch ms; flag turns on only at/after this time
  operatorOverrides?: Record<string, boolean>;
}

/**
 * Evaluates a feature flag for a operator: a per-operator override wins; otherwise a
 * scheduled flag is off until its time arrives; otherwise the global switch applies.
 */
export function evaluateFlag(flag: FeatureFlagState, operatorId: string | null, nowMs: number): boolean {
  if (operatorId && flag.operatorOverrides && operatorId in flag.operatorOverrides) {
    return flag.operatorOverrides[operatorId];
  }
  if (flag.scheduledAt && nowMs < flag.scheduledAt) return false;
  return flag.enabledGlobally;
}

/** Returns the keys whose values differ between two config snapshots (for version compare). */
export function diffConfig(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(key);
  }
  return changed.sort();
}
