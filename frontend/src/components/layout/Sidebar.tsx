import { useMemo } from 'react';
import { Brand, BusMark } from '@/components/ui/Brand';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useAuthStore } from '@/core/auth/auth.store';
import { NAV_SECTIONS, type NavSection } from '@/navigation/nav.config';
import { useAppearance } from '@/theme/ThemeProvider';
import { IconButton } from '@/components/ui';

/** The brand block. Falls back to a wordmark when no logo has been uploaded. */
function BrandMark({ collapsed }: { collapsed: boolean }) {
  const appearance = useAppearance();

  return (
    <div className={cn('flex h-16 items-center gap-2.5 border-b border-line px-4', collapsed && 'justify-center px-0')}>
      {collapsed ? (
        <BusMark className="h-8 w-8" />
      ) : (
        <Brand size="md" tone="inherit" className="text-sidebar-fg" />
      )}
    </div>
  );
}

export function Sidebar({
  isOpen,
  onClose,
  collapsed,
}: {
  /** Mobile only: the drawer state. On desktop the sidebar is always present. */
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
}) {
  const canAny = useAuthStore((state) => state.canAny);
  const hasRole = useAuthStore((state) => state.hasRole);
  const permissions = useAuthStore((state) => state.permissions);
  const user = useAuthStore((state) => state.user);

  /**
   * Filter the menu against what this user can actually do. Recomputed when the
   * permission set changes, so a permission granted mid-session appears without a reload.
   */
  const sections = useMemo<NavSection[]>(() => {
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.roles && !hasRole(...item.roles)) return false;
        if (item.anyOf && !canAny(item.anyOf)) return false;
        return true;
      }),
    })).filter((section) => section.items.length > 0);
    // `permissions` and `user` are the real inputs; the callbacks read from the store.
  }, [canAny, hasRole, permissions, user]);

  return (
    <>
      {/* Mobile scrim */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-sidebar transition-transform duration-motion',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ width: collapsed ? '72px' : 'var(--sidebar-width)' }}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between">
          <BrandMark collapsed={collapsed} />
          <IconButton label="Close menu" className="mr-2 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {sections.map((section) => (
            <div key={section.id} className="mb-4 last:mb-0">
              {!collapsed && (
                <p className="px-4 pb-1.5 font-mono text-step--1 font-medium uppercase tracking-wider text-ink-faint">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5 px-2">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-3 rounded-control px-2.5 py-2 text-step-0 transition-colors duration-motion',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-primary font-medium text-primary-fg'
                            : 'text-sidebar-fg/80 hover:bg-sidebar-active/60 hover:text-sidebar-fg',
                        )
                      }
                    >
                      {() => (
                        <>
                          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
