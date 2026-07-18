import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-error';

/**
 * One cache for the whole app.
 *
 * Defaults are tuned for an operations console: data is treated as fresh for half a
 * minute (so tabbing between screens doesn't re-fetch everything), and retries only
 * happen for failures a retry could actually fix — never for a 403 or a validation error.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && !error.isRetryable) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Query keys in one place. Colocating them means a mutation can invalidate exactly what
 * it touched — `queryKeys.buses.all` kills every bus query, `queryKeys.buses.detail(id)`
 * kills one — without any screen guessing at another screen's key.
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    permissions: ['auth', 'permissions'] as const,
  },
  appearance: ['appearance'] as const,
  platformConfig: {
    all: ['platform-config'] as const,
    settings: (namespace: string) => ['platform-config', 'settings', namespace] as const,
    effective: (namespace: string) => ['platform-config', 'effective', namespace] as const,
    flags: ['platform-config', 'flags'] as const,
    versions: (namespace: string) => ['platform-config', 'versions', namespace] as const,
  },
  resource: (name: string, params?: unknown) =>
    params === undefined ? ([name] as const) : ([name, params] as const),
  detail: (name: string, id: string) => [name, 'detail', id] as const,
} as const;
