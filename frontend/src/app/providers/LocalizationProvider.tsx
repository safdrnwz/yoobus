import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformConfigApi } from '@/features/settings/api/settings.api';
import { configureFormatting } from '@/core/utils/format';

/**
 * Currency, locale and timezone come from the server. They always did — the LOCALIZATION
 * namespace has been live in Global Settings from the start.
 *
 * But `configureFormatting()` was never called by anything, so `format.ts` sat on its
 * fallbacks forever: every price in the product was rendered as ₹ / en-IN, and changing
 * "Default currency" in Global Settings changed precisely nothing. The setting existed,
 * the screen existed, and the two were never connected.
 *
 * This connects them. It runs once, before the app paints anything money-shaped.
 */
export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ['settings', 'LOCALIZATION'],
    queryFn: () => platformConfigApi.effective('LOCALIZATION'),
    // These change about once a year. Don't re-fetch them on every window focus.
    staleTime: 10 * 60 * 1000,
    // A passenger who is not signed in still sees prices. If the endpoint refuses us,
    // the fallbacks in format.ts are correct enough — never block the app on this.
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    configureFormatting({
      currency: typeof data.defaultCurrency === 'string' ? data.defaultCurrency : undefined,
      locale: typeof data.defaultLanguage === 'string' ? data.defaultLanguage : undefined,
    });
  }, [data]);

  return <>{children}</>;
}
