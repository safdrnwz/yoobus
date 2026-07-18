import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/query-client';
import { appearanceApi } from '@/features/settings/api/settings.api';
import { applyAppearance, applyBrandingChrome } from './apply-theme';
import { DEFAULT_APPEARANCE } from './defaults';
import type { AppearanceSettings } from './theme.types';

interface ThemeContextValue {
  /** The theme currently painted on screen — the draft while previewing, else the saved one. */
  appearance: AppearanceSettings;
  /** The theme as persisted on the server, ignoring any unsaved preview. */
  saved: AppearanceSettings;
  isLoading: boolean;
  isPreviewing: boolean;
  /** Paints an unsaved theme so the admin sees the real thing, not a swatch. */
  preview: (draft: Partial<AppearanceSettings> | null) => void;
  /** Drops the preview and repaints what's on the server. */
  cancelPreview: () => void;
  /** Re-reads the theme after a save so every tab converges on the saved values. */
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Owns the look and feel of every screen.
 *
 * The theme comes from the API (public read), is merged over the built-in defaults so a
 * missing key can never leave the UI unstyled, and is written to the document as CSS
 * custom properties. Because Tailwind resolves its colours from those properties, a save
 * in Global Settings repaints the whole console without a reload or a re-render.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Partial<AppearanceSettings> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.appearance,
    queryFn: appearanceApi.get,
    // The theme is stable and needed everywhere; don't re-fetch it on every screen.
    staleTime: 10 * 60_000,
    retry: 1,
  });

  // Defaults underneath, server values on top: a key the server hasn't stored still resolves.
  const saved = useMemo<AppearanceSettings>(() => ({ ...DEFAULT_APPEARANCE, ...(data ?? {}) }), [data]);

  const appearance = useMemo<AppearanceSettings>(
    () => (draft ? { ...saved, ...draft } : saved),
    [saved, draft],
  );

  // The single place the DOM is touched. Everything else just changes this object.
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  // Tab title and favicon follow the brand, but only the saved one — a preview shouldn't
  // rewrite the browser chrome for a change that may be discarded.
  useEffect(() => {
    applyBrandingChrome(saved);
  }, [saved]);

  const preview = useCallback((next: Partial<AppearanceSettings> | null) => setDraft(next), []);
  const cancelPreview = useCallback(() => setDraft(null), []);

  const refresh = useCallback(async () => {
    setDraft(null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.appearance });
  }, [queryClient]);

  const value = useMemo<ThemeContextValue>(
    () => ({ appearance, saved, isLoading, isPreviewing: draft !== null, preview, cancelPreview, refresh }),
    [appearance, saved, isLoading, draft, preview, cancelPreview, refresh],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return context;
}

/** Read-only access to the live theme — for charts and anything that needs a raw colour. */
export function useAppearance(): AppearanceSettings {
  return useTheme().appearance;
}
