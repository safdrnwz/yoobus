import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings, User } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useAuthStore } from '@/core/auth/auth.store';
import { useAuth } from '@/app/providers/AuthProvider';
import { ROLE_LABELS } from '@/core/rbac/roles';
import { initials } from '@/core/utils/format';
import { IconButton, Badge } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export function Topbar({
  onOpenSidebar,
  onToggleCollapse,
  collapsed,
}: {
  onOpenSidebar: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const { signOut } = useAuth();
  const { isPreviewing } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/sign-in', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur">
      <IconButton label="Open menu" className="lg:hidden" onClick={onOpenSidebar}>
        <Menu className="h-4 w-4" />
      </IconButton>

      <IconButton
        label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden lg:inline-flex"
        onClick={onToggleCollapse}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </IconButton>

      <div className="flex-1" />

      {/* An unsaved theme is painted across the whole app, so it must be announced. */}
      {isPreviewing && (
        <Badge tone="warning" dot>
          Previewing unsaved theme
        </Badge>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-control px-1.5 py-1 transition-colors duration-motion hover:bg-surface-sunken"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-pill bg-secondary text-step--1 font-semibold text-secondary-fg"
            aria-hidden
          >
            {initials(user?.fullName)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[160px] truncate text-step--1 font-medium text-ink">{user?.fullName}</span>
            <span className="block text-step--1 text-ink-muted">{user ? ROLE_LABELS[user.role] : ''}</span>
          </span>
          <ChevronDown className={cn('h-4 w-4 text-ink-muted transition-transform duration-motion', menuOpen && 'rotate-180')} aria-hidden />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-surface border-hair border-line bg-surface shadow-pop"
            >
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-step-0 font-medium text-ink">{user?.fullName}</p>
                <p className="truncate text-step--1 text-ink-muted">{user?.email}</p>
              </div>
              <div className="p-1">
                <Link
                  to="/account"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-control px-3 py-2 text-step-0 text-ink transition-colors duration-motion hover:bg-surface-sunken"
                >
                  <User className="h-4 w-4" aria-hidden /> Your account
                </Link>
                <Link
                  to="/account/security"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-control px-3 py-2 text-step-0 text-ink transition-colors duration-motion hover:bg-surface-sunken"
                >
                  <Settings className="h-4 w-4" aria-hidden /> Password & security
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-step-0 text-danger transition-colors duration-motion hover:bg-danger-soft"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
