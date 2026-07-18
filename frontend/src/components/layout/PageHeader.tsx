import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * The consistent top of every screen (LaunchKit style): a mono breadcrumb, a small
 * "• SECTION" eyebrow, a bold headline, and an optional description + actions.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  /** Small uppercase label above the headline. Falls back to the last breadcrumb. */
  eyebrow?: string;
  className?: string;
}) {
  const eyebrowText = eyebrow ?? (breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : undefined);

  return (
    <div className={cn('mb-gutter', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1.5 font-mono text-step--1 text-ink-muted">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {crumb.to ? (
                  <Link to={crumb.to} className="transition-colors duration-motion hover:text-ink">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-ink">{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3 text-ink-faint" aria-hidden />}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrowText && (
            <p className="mb-2 flex items-center gap-2 font-mono text-step--1 font-medium uppercase tracking-wider text-ink-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
              {eyebrowText}
            </p>
          )}
          <h1 className="text-step-3 font-bold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-step-0 text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
