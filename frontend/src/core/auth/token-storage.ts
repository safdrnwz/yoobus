/**
 * Where tokens live.
 *
 * The access token is held in memory only, so an injected script can't lift it out of
 * storage and it dies with the tab. The refresh token is persisted, because staying
 * signed in across reloads is a product requirement — the backend hashes it, rotates it
 * on every use, and revokes it on logout, which is what limits the exposure.
 */
const REFRESH_KEY = 'yoobus.refresh';
const USER_KEY = 'yoobus.user';

let accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken: (): string | null => accessToken,

  setAccessToken: (token: string | null): void => {
    accessToken = token;
  },

  getRefreshToken: (): string | null => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  setRefreshToken: (token: string | null): void => {
    try {
      if (token) localStorage.setItem(REFRESH_KEY, token);
      else localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* storage blocked (private mode): the session just won't survive a reload */
    }
  },

  /** A cached user so the shell can paint before /auth/me returns. */
  getCachedUser: <T>(): T | null => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  setCachedUser: (user: unknown | null): void => {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  },

  clear: (): void => {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  },
};
