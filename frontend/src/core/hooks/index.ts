import { useCallback, useEffect, useMemo, useState } from 'react';

/** Delays a fast-changing value — keeps search boxes from firing a request per keystroke. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Open/close state for modals, drawers and menus. */
export function useDisclosure(initial = false) {
  const [isOpen, setOpen] = useState(initial);
  return {
    isOpen,
    open: useCallback(() => setOpen(true), []),
    close: useCallback(() => setOpen(false), []),
    toggle: useCallback(() => setOpen((value) => !value), []),
  };
}

/** Page/limit/search state shared by every list screen. */
export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearchRaw] = useState('');
  const debouncedSearch = useDebounced(search);

  // A new search term invalidates the current page number.
  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);

  const params = useMemo(
    () => ({ page, limit, ...(debouncedSearch ? { search: debouncedSearch } : {}) }),
    [page, limit, debouncedSearch],
  );

  return { page, setPage, limit, setLimit, search, setSearch, params };
}

/** True once the viewport is at or below the given breakpoint. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', listener);
    setMatches(list.matches);
    return () => list.removeEventListener('change', listener);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
