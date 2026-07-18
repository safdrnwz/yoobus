import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/core/config/env';
import { tokenStorage } from '@/core/auth/token-storage';
import { ApiError, toApiError } from './api-error';
import type { ApiEnvelope } from './types';

/** Flags a request we've already retried, so a failing refresh can't loop forever. */
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
  /** Auth calls must never trigger the refresh interceptor — that would recurse. */
  skipAuthRefresh?: boolean;
}

const instance: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

/* ---------------------------------------------------------------- *
 * Request: attach the bearer token
 * ---------------------------------------------------------------- */
instance.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ---------------------------------------------------------------- *
 * Response: refresh once, replay everything
 *
 * When a token expires, several queries usually fail at the same instant. Refreshing
 * per-request would fire N refreshes and — because the backend rotates refresh tokens —
 * all but the first would be rejected, logging the user out mid-session. So the first
 * 401 starts one refresh; every other request waits on that same promise and is then
 * replayed with the new token.
 * ---------------------------------------------------------------- */

let refreshPromise: Promise<string> | null = null;
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler = () => {};

/** Lets the auth layer decide what "signed out" means (redirect, clear cache, toast). */
export function setSessionExpiredHandler(handler: SessionExpiredHandler): void {
  onSessionExpired = handler;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new ApiError({ code: 'NO_REFRESH_TOKEN', message: 'Your session has ended. Sign in to continue.', status: 401 });

  // A bare axios call: it must not pick up the interceptors below.
  const response = await axios.post<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
    `${env.apiBaseUrl}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );

  const tokens = response.data.data;
  tokenStorage.setAccessToken(tokens.accessToken);
  tokenStorage.setRefreshToken(tokens.refreshToken);
  return tokens.accessToken;
}

instance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const config = (error as { config?: RetryableConfig }).config;
    const status = (error as { response?: { status?: number } }).response?.status;

    const canRetry = status === 401 && config && !config._retried && !config.skipAuthRefresh && tokenStorage.getRefreshToken();

    if (!canRetry) return Promise.reject(toApiError(error));

    config._retried = true;

    try {
      // Everyone shares the one in-flight refresh.
      refreshPromise = refreshPromise ?? refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const token = await refreshPromise;

      config.headers.Authorization = `Bearer ${token}`;
      return instance.request(config);
    } catch {
      // The refresh token is dead too — this session is genuinely over.
      tokenStorage.clear();
      onSessionExpired();
      return Promise.reject(
        new ApiError({ code: 'SESSION_EXPIRED', message: 'Your session has ended. Sign in to continue.', status: 401 }),
      );
    }
  },
);

/** Unwraps `{ success, statusCode, data }` so callers only ever see the payload. */
function unwrap<T>(response: AxiosResponse<ApiEnvelope<T> | T>): T {
  const body = response.data as ApiEnvelope<T>;
  return body && typeof body === 'object' && 'data' in body && 'success' in body ? body.data : (response.data as T);
}

/**
 * The only way the app talks to the backend. Every feature's service layer builds on
 * this, so retries, refresh, error shape and envelope handling are solved exactly once.
 */
export const http = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => unwrap<T>(await instance.get(url, config)),

  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    unwrap<T>(await instance.post(url, body, config)),

  put: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    unwrap<T>(await instance.put(url, body, config)),

  patch: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    unwrap<T>(await instance.patch(url, body, config)),

  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => unwrap<T>(await instance.delete(url, config)),

  /** For binary endpoints such as GET /bookings/:id/ticket.pdf. */
  blob: async (url: string, config?: AxiosRequestConfig): Promise<Blob> => {
    const response = await instance.get<Blob>(url, { ...config, responseType: 'blob' });
    return response.data;
  },
};

export { instance as axiosInstance };
