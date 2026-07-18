/** Typed access to build-time configuration, so no component reads import.meta directly. */
interface AppEnv {
  apiBaseUrl: string;
  appName: string;
  isProduction: boolean;
}

export const env: AppEnv = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  appName: import.meta.env.VITE_APP_NAME ?? 'Yoo Bus',
  isProduction: import.meta.env.PROD,
};
