import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setSessionExpiredHandler } from '@/core/api/http-client';
import { tokenStorage } from '@/core/auth/token-storage';
import { useAuthStore, type AuthUser } from '@/core/auth/auth.store';
import { authApi, rbacApi, type LoginPayload, type Session } from '@/features/auth/api/auth.api';

interface AuthContextValue {
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  /** Used after OTP registration, which returns a full session on verification. */
  adoptSession: (session: Session) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  reloadPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the session lifecycle.
 *
 * On boot we hold a refresh token but no access token (the access token lives in memory
 * and died with the last tab). Rather than trust the cached user, we ask the API who we
 * are: the http client sees the 401, silently refreshes, and replays the call. If that
 * fails, the session really is over and we land on the sign-in screen.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { setSession, setUser, setPermissions, setStatus, clear } = useAuthStore();
  const booted = useRef(false);

  /** Permissions are always read from the server — never inferred from the role. */
  const loadPermissions = useCallback(async () => {
    try {
      const permissions = await rbacApi.myPermissions();
      setPermissions(permissions);
    } catch {
      // A user with no permission set simply sees nothing they can't use.
      setPermissions([]);
    }
  }, [setPermissions]);

  // Give the http client a way to tell us the refresh token is dead.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clear();
      queryClient.clear();
      toast.error('Your session has ended. Sign in to continue.');
    });
  }, [clear, queryClient]);

  // Restore the session once, on first mount.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const restore = async () => {
      if (!tokenStorage.getRefreshToken()) {
        setStatus('anonymous');
        return;
      }
      try {
        const user = await authApi.me();
        setUser(user);
        await loadPermissions();
        setStatus('authenticated');
      } catch {
        clear();
      }
    };

    void restore();
  }, [clear, loadPermissions, setStatus, setUser]);

  const adoptSession = useCallback(
    async (session: Session) => {
      setSession(session);
      await loadPermissions();
      return session.user;
    },
    [setSession, loadPermissions],
  );

  const signIn = useCallback(
    async (payload: LoginPayload) => adoptSession(await authApi.login(payload)),
    [adoptSession],
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      // Revoke the token server-side; a failure here must not trap the user in the app.
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      /* ignore */
    } finally {
      clear();
      queryClient.clear();
    }
  }, [clear, queryClient]);

  const signOutEverywhere = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      clear();
      queryClient.clear();
    }
  }, [clear, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ signIn, adoptSession, signOut, signOutEverywhere, reloadPermissions: loadPermissions }),
    [signIn, adoptSession, signOut, signOutEverywhere, loadPermissions],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
