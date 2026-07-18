import { http } from '@/core/api/http-client';
import type { AppearanceSettings } from '@/theme/theme.types';
import type { BulkSetSettingsDto } from '@/core/api/generated/dtos';

export type SettingNamespace =
  | 'GENERAL' | 'LOCALIZATION' | 'SECURITY' | 'BOOKING'
  | 'PAYMENT' | 'NOTIFICATION' | 'RETENTION' | 'INTEGRATION' | 'APPEARANCE';

export interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  enabledGlobally: boolean;
  scheduledAt: string | null;
  operatorOverrides: Record<string, boolean>;
}

export interface ConfigVersion {
  id: string;
  namespace: SettingNamespace;
  snapshot: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

type SettingEntry = { key: string; value: unknown };

/** Turns a settings object into the { settings: [...] } body the bulk endpoint expects. */
function toEntries(values: Record<string, unknown>): { settings: SettingEntry[] } {
  return { settings: Object.entries(values).map(([key, value]) => ({ key, value })) };
}

/**
 * Global Settings.
 *
 * GET /appearance is public — the sign-in screen must paint the brand before anyone has a
 * token. Every write is SuperAdmin-only and enforced by the backend; the UI hiding the
 * form is a courtesy, not the control.
 */
export const appearanceApi = {
  get: () => http.get<AppearanceSettings>('/appearance'),

  /** Saves the whole theme as one atomic, versioned change. */
  update: (values: Partial<AppearanceSettings>) => http.put<AppearanceSettings>('/appearance', toEntries(values)),

  reset: () => http.post<AppearanceSettings>('/appearance/reset'),

  versions: () => http.get<ConfigVersion[]>('/appearance/versions'),
};

/** The rest of the platform configuration surface (SuperAdmin only). */
export const platformConfigApi = {
  allSettings: () => http.get<Record<string, Record<string, unknown>>>('/platform-config/settings'),

  /** Defaults merged with saved overrides — what is actually in force. */
  effective: (namespace: SettingNamespace) =>
    http.get<Record<string, unknown>>(`/platform-config/effective/${namespace}`),

  setSetting: (payload: { namespace: SettingNamespace; key: string; value: unknown }) =>
    http.post<unknown>('/platform-config/settings', payload),

  /** `values` is the flat { key: value } map the form holds; toEntries() shapes it into
   *  the { settings: [{key, value}] } body the server validates. */
  setNamespace: (namespace: SettingNamespace, values: Record<string, unknown>) =>
    http.put<Record<string, unknown>>(`/platform-config/settings/${namespace}`, toEntries(values)),

  resetNamespace: (namespace: SettingNamespace) =>
    http.post<Record<string, unknown>>(`/platform-config/settings/${namespace}/reset`),

  listFlags: () => http.get<FeatureFlag[]>('/platform-config/flags'),

  upsertFlag: (payload: { key: string; description?: string; enabledGlobally?: boolean; scheduledAt?: string }) =>
    http.post<FeatureFlag>('/platform-config/flags', payload),

  setFlagOverride: (key: string, payload: { operatorId: string; enabled: boolean }) =>
    http.post<FeatureFlag>(`/platform-config/flags/${key}/override`, payload),

  clearFlagOverride: (key: string, operatorId: string) =>
    http.delete<FeatureFlag>(`/platform-config/flags/${key}/override/${operatorId}`),

  versions: (namespace: SettingNamespace) => http.get<ConfigVersion[]>(`/platform-config/versions/${namespace}`),

  restoreVersion: (id: string) => http.post<Record<string, unknown>>(`/platform-config/versions/${id}/restore`),
};
