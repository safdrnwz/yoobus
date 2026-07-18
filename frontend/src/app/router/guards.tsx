import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore } from '@/core/auth/auth.store';
import { ROLE_HOME, type Role } from '@/core/rbac/roles';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { Link } from 'react-router-dom';

/** Held while the session is being restored, so we never flash the sign-in screen. */
function Booting() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

/** Requires a signed-in user. Remembers where they were headed so sign-in can return them. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'booting') return <Booting />;
  if (status === 'anonymous') return <Navigate to="/sign-in" state={{ from: location }} replace />;

  return <>{children}</>;
}

/** Keeps signed-in users off the sign-in and register screens. */
export function RequireAnonymous({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'booting') return <Booting />;
  if (status === 'authenticated' && user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  return <>{children}</>;
}

/**
 * Gates a route on roles and/or permissions.
 *
 * A denied route renders an explanation rather than redirecting: silently bouncing
 * someone to a dashboard leaves them unsure whether the link was broken or forbidden.
 */
export function RequireAccess({
  children,
  roles,
  anyOf,
}: {
  children: ReactNode;
  roles?: Role[];
  anyOf?: string[];
}) {
  const hasRole = useAuthStore((state) => state.hasRole);
  const canAny = useAuthStore((state) => state.canAny);
  const user = useAuthStore((state) => state.user);

  const roleOk = !roles || hasRole(...roles);
  const permissionOk = !anyOf || canAny(anyOf);

  if (roleOk && permissionOk) return <>{children}</>;

  return (
    <EmptyState
      icon={<Lock className="h-5 w-5" />}
      title="You do not have access to this"
      description="This area is restricted. If you need it, ask a platform administrator to grant you the permission."
      action={
        user ? (
          <Button onClick={() => window.history.back()} variant="outline">
            Go back
          </Button>
        ) : null
      }
    />
  );
}

/** Sends a signed-in user to the screen that matters most for their role. */
export function RoleHomeRedirect() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  if (status === 'booting') return <Booting />;
  if (!user) return <Navigate to="/sign-in" replace />;

  return <Navigate to={ROLE_HOME[user.role]} replace />;
}

export function NotFound() {
  return (
    <EmptyState
      title="That page does not exist"
      description="The link may be out of date, or the page may have moved."
      action={
        <Link to="/">
          <Button>Back to your dashboard</Button>
        </Link>
      }
    />
  );
}
