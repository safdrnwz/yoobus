import { Link, Outlet } from 'react-router-dom';
import { Brand, BusMark } from '@/components/ui/Brand';
import { Building2, LogIn, MapPin } from 'lucide-react';
import { Button } from '@/components/ui';
import { Footer } from './Footer';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuthStore } from '@/core/auth/auth.store';
import { ROLE_HOME } from '@/core/rbac/roles';

/**
 * The shell a guest sees.
 *
 * Search, results and the seat map are all public on the server, and they should be public
 * here too: making someone create an account before they have seen a single bus is how you
 * lose them. AppShell is no use for this — it is a console with a sidebar, a role-driven
 * menu and an authenticated user. A guest has none of those.
 *
 * So: brand, a way in, the page, and nothing else.
 */
export function PublicSearchLayout() {
  const { appearance } = useTheme();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b-hair border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/search" aria-label="YooBus home">
            <Brand size="md" />
          </Link>

          <div className="flex items-center gap-2">
            {/* Marketing CTA — only on the customer site, never on the staff console. */}
            <Link to="/become-an-operator">
              <Button variant="outline" size="sm" leftIcon={<Building2 className="h-4 w-4" />}>
                Become an Operator
              </Button>
            </Link>

            {status === 'authenticated' && user ? (
              <Link to={ROLE_HOME[user.role]}>
                <Button variant="ghost" size="sm">
                  My account
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/sign-in">
                  <Button variant="ghost" size="sm" leftIcon={<LogIn className="h-4 w-4" />}>
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Create account</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Attractive customer hero */}
      <section className="relative overflow-hidden border-b-hair border-line bg-gradient-to-br from-red-50 via-surface to-amber-50">
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-9 sm:py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-step--1 font-semibold text-red-700 shadow-sm ring-1 ring-red-100">
            <MapPin className="h-3.5 w-3.5" /> Thousands of routes across India
          </span>
          <h1 className="max-w-2xl font-display text-step-4 font-extrabold leading-[1.1] tracking-tight text-ink">
            Book your <span className="text-red-600">bus</span> in seconds.
          </h1>
          <p className="max-w-lg text-step-1 text-ink-muted">
            Live seat maps, instant tickets and the best fares &mdash; no account needed to search.
          </p>
          <div className="mt-1 flex items-center gap-4 text-step--1 text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><BusMark className="h-4 w-4" /> Verified operators</span>
            <span>&bull;</span>
            <span>Instant e-tickets</span>
            <span>&bull;</span>
            <span>Live tracking</span>
          </div>
        </div>

        {/* decorative scene */}
        <svg className="pointer-events-none absolute bottom-0 right-0 hidden h-44 w-auto opacity-95 sm:block" viewBox="0 0 440 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="360" cy="46" r="26" fill="#FDE68A" />
          {/* skyline */}
          <rect x="40" y="70" width="34" height="70" rx="4" fill="#fecdd3" />
          <rect x="82" y="52" width="30" height="88" rx="4" fill="#fda4af" />
          <rect x="120" y="82" width="26" height="58" rx="4" fill="#fecdd3" />
          <rect x="300" y="78" width="30" height="62" rx="4" fill="#fecaca" />
          <rect x="338" y="62" width="26" height="78" rx="4" fill="#fda4af" />
          {/* road */}
          <rect x="0" y="140" width="440" height="40" fill="#1f2937" opacity="0.9" />
          <rect x="0" y="158" width="440" height="4" fill="#f9fafb" opacity="0.6" strokeDasharray="18 14" />
          <line x1="0" y1="160" x2="440" y2="160" stroke="#fbbf24" strokeWidth="3" strokeDasharray="20 16" />
          {/* bus */}
          <g transform="translate(160 96)">
            <rect x="0" y="0" width="132" height="48" rx="10" fill="#E11D2A" />
            <rect x="8" y="8" width="24" height="18" rx="3" fill="#ffffff" opacity="0.95" />
            <rect x="36" y="8" width="24" height="18" rx="3" fill="#ffffff" opacity="0.95" />
            <rect x="64" y="8" width="24" height="18" rx="3" fill="#ffffff" opacity="0.95" />
            <rect x="92" y="8" width="20" height="18" rx="3" fill="#ffffff" opacity="0.95" />
            <rect x="116" y="10" width="12" height="26" rx="3" fill="#b91c1c" />
            <rect x="6" y="34" width="120" height="6" rx="3" fill="#ffffff" opacity="0.25" />
            <circle cx="126" cy="20" r="2.4" fill="#FFD34E" />
            <circle cx="34" cy="50" r="9" fill="#15161a" />
            <circle cx="34" cy="50" r="3.5" fill="#ffffff" />
            <circle cx="100" cy="50" r="9" fill="#15161a" />
            <circle cx="100" cy="50" r="3.5" fill="#ffffff" />
          </g>
        </svg>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
