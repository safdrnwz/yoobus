import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { LocalizationProvider } from '@/app/providers/LocalizationProvider';
import { router } from '@/app/router/routes';

/**
 * The provider order is deliberate.
 *
 * QueryProvider is outermost of the data providers because ThemeProvider fetches the
 * theme through React Query, and AuthProvider needs the cache to clear it on sign-out.
 * ThemeProvider sits above AuthProvider so the sign-in screen — which renders before
 * anyone is authenticated — is already painted in the operator's brand.
 *
 * LocalizationProvider sits beside it for the same reason: currency and locale come from
 * Global Settings, and a price must never be painted in the wrong currency first and
 * corrected a moment later.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ThemeProvider>
          <LocalizationProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-surface)',
                  fontFamily: 'var(--font-body)',
                },
              }}
            />
          </AuthProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
