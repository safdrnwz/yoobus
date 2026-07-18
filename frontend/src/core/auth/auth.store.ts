import { create } from 'zustand';
import { tokenStorage } from './token-storage';
import type { Role } from '@/core/rbac/roles';

/** The JWT claims the backend puts on req.user (common/decorators/current-user.decorator.ts). */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** null for platform staff and passengers; set for every operator-scoped user. */
  operatorId: string | null;
}

export type AuthStatus = 'booting' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Effective permissions from GET /rbac/me — role defaults plus any operator overrides. */
  permissions: Set<string>;

  setSession: (params: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setUser: (user: AuthUser) => void;
  setPermissions: (permissions: string[]) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;

  /** True only if the backend actually granted this permission to this user. */
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  user: tokenStorage.getCachedUser<AuthUser>(),
  permissions: new Set<string>(),

  setSession: ({ user, accessToken, refreshToken }) => {
    tokenStorage.setAccessToken(accessToken);
    tokenStorage.setRefreshToken(refreshToken);
    tokenStorage.setCachedUser(user);
    set({ user, status: 'authenticated' });
  },

  setUser: (user) => {
    tokenStorage.setCachedUser(user);
    set({ user });
  },

  setPermissions: (permissions) => set({ permissions: new Set(permissions) }),

  setStatus: (status) => set({ status }),

  clear: () => {
    tokenStorage.clear();
    set({ user: null, permissions: new Set(), status: 'anonymous' });
  },

  can: (permission) => get().permissions.has(permission),

  canAny: (permissions) => {
    // An empty requirement means "no permission needed" — don't accidentally lock people out.
    if (permissions.length === 0) return true;
    const granted = get().permissions;
    return permissions.some((permission) => granted.has(permission));
  },

  canAll: (permissions) => {
    if (permissions.length === 0) return true;
    const granted = get().permissions;
    return permissions.every((permission) => granted.has(permission));
  },

  hasRole: (...roles) => {
    const role = get().user?.role;
    return role ? roles.includes(role) : false;
  },
}));

/* Selector hooks — subscribing to a slice keeps a colour change in Settings from
 * re-rendering every screen that only cares about who is signed in. */
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useAuthStatus = () => useAuthStore((state) => state.status);
export const useCan = () => useAuthStore((state) => state.can);
export const useCanAny = () => useAuthStore((state) => state.canAny);
export const useHasRole = () => useAuthStore((state) => state.hasRole);
