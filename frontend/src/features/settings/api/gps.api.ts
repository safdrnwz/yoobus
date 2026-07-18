import { http } from '@/core/api/http-client';

export interface GpsProvider {
  providerName: string;
  enabled: boolean;
}

export interface GpsConfig {
  id?: string;
  operatorId?: string;
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  apiSecret?: string | null;
  clientId?: string | null;
  accessToken?: string | null;
  webhookUrl?: string | null;
  status?: string;
  lastTestedAt?: string | null;
}

export interface GpsDevice {
  id: string;
  operatorId: string;
  busId: string;
  provider: string;
  imei: string;
  deviceId: string | null;
  status: string;
  createdAt: string;
}

/** GPS Integration — mirrors the backend `modules/operator/gps` controllers. */
export const gpsApi = {
  // Platform (SuperAdmin): which providers are switched on for the whole platform.
  listProviders: () => http.get<GpsProvider[]>('/gps/providers'),
  setProvider: (providerName: string, enabled: boolean) =>
    http.put<GpsProvider>('/gps/providers', { providerName, enabled }),

  // Operator: the connected provider's credentials.
  getConfig: () => http.get<GpsConfig | null>('/gps/config'),
  saveConfig: (body: Partial<GpsConfig>) => http.put<GpsConfig>('/gps/config', body),
  testConnection: () => http.post<{ ok: boolean; status: string; provider: string }>('/gps/config/test'),

  // Operator: bus <-> device mapping.
  listDevices: () => http.get<GpsDevice[]>('/gps/devices'),
  mapDevice: (body: { busId: string; imei: string; deviceId?: string }) =>
    http.post<GpsDevice>('/gps/devices', body),
  unmapDevice: (id: string) => http.delete<{ ok: boolean }>(`/gps/devices/${id}`),
};
