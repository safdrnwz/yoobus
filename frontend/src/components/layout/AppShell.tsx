import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Footer } from './Footer';
import { useAppearance } from '@/theme/ThemeProvider';
import { useIsMobile } from '@/core/hooks';

/**
 * The frame every signed-in screen sits inside.
 *
 * The sidebar's default collapsed state is itself a global setting, so an operator who
 * runs on small counter monitors can ship the whole estate a collapsed rail by default —
 * while any individual can still expand it for their own session.
 */
export function AppShell() {
  const appearance = useAppearance();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(appearance.sidebarCollapsed);

  // Follow the admin's default whenever it changes.
  useEffect(() => {
    setCollapsed(appearance.sidebarCollapsed);
  }, [appearance.sidebarCollapsed]);

  // The drawer is a mobile idea; leaving it "open" behind a desktop layout traps focus.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} collapsed={!isMobile && collapsed} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenSidebar={() => setDrawerOpen(true)}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          collapsed={collapsed}
        />

        <main className="flex-1 px-gutter py-gutter">
          <div className="mx-auto w-full max-w-content">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
