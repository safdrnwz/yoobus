import type { ReactNode } from 'react';
import { Brand } from '@/components/ui/Brand';
import { useAppearance } from '@/theme/ThemeProvider';

/**
 * The frame for every unauthenticated screen.
 *
 * It is themed from the same Global Settings the console uses, which is why the
 * appearance endpoint is a public read: the brand has to be on screen before anyone has
 * a token.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const appearance = useAppearance();

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* The brand panel: quiet, structural, no gloss. */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-secondary p-12 text-secondary-fg lg:flex">
        {/* A route line — the product's own subject, used as the only ornament. */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
          viewBox="0 0 400 800"
          fill="none"
          aria-hidden
        >
          <path
            d="M40 780 C 40 600, 200 560, 200 400 S 360 200, 360 20"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="6 10"
          />
          {[780, 620, 480, 400, 260, 120, 20].map((y, index) => (
            <circle key={y} cx={index % 2 === 0 ? 40 + index * 26 : 360 - index * 22} cy={y} r="4" fill="currentColor" />
          ))}
        </svg>

        <div className="relative flex items-center gap-3">
          <Brand size="lg" />
        </div>

        <div className="relative max-w-sm">
          <h2 className="font-display text-step-4 leading-tight">
            Every bus, route and rupee — on one console.
          </h2>
          <p className="mt-3 text-step-0 opacity-75">
            Fleet, scheduling, ticketing, settlements and compliance for multi-operator bus operators.
          </p>
        </div>

        <p className="relative text-step--1 opacity-60">{appearance.footerText}</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary font-semibold text-primary-fg">
              {appearance.brandName.charAt(0).toUpperCase()}
            </span>
          </div>

          <h1 className="text-step-3 text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-step-0 text-ink-muted">{subtitle}</p>}

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
