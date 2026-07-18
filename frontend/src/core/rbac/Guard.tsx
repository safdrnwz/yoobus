import type { ReactNode } from 'react';
import { useAuthStore } from '@/core/auth/auth.store';
import type { Role } from './roles';

/**
 * Hides UI a user cannot use.
 *
 * This is not the security boundary — the backend guards every route and will return 403
 * regardless of what the client renders. This exists so people aren't shown buttons that
 * only ever fail.
 */
export function Can({
  permission,
  anyOf,
  role,
  children,
  fallback = null,
}: {
  permission?: string;
  /** Any one of these is enough. */
  anyOf?: string[];
  role?: Role | Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const can = useAuthStore((state) => state.can);
  const canAny = useAuthStore((state) => state.canAny);
  const hasRole = useAuthStore((state) => state.hasRole);

  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!hasRole(...roles)) return <>{fallback}</>;
  }
  if (permission && !can(permission)) return <>{fallback}</>;
  if (anyOf && !canAny(anyOf)) return <>{fallback}</>;

  return <>{children}</>;
}
