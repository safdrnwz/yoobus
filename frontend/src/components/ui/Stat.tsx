import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Skeleton } from './Feedback';

/**
 * The instrument panel.
 *
 * Figures are set in the mono face and tabular numerals so a column of them lines up and
 * a change in value doesn't shift the layout — the same reason a dashboard gauge has a
 * fixed needle sweep.
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  isLoading,
  tone = 'default',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Percentage change against the previous period. Positive is not always good. */
  delta?: { value: number; positiveIsGood?: boolean };
  icon?: ReactNode;
  isLoading?: boolean;
  tone?: 'default' | 'primary' | 'accent';
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className="rounded-surface border-hair border-line bg-surface p-gutter shadow-card">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-32" />
        <Skeleton className="mt-3 h-3 w-20" />
      </div>
    );
  }

  const isUp = (delta?.value ?? 0) >= 0;
  const positiveIsGood = delta?.positiveIsGood ?? true;
  const isGood = isUp === positiveIsGood;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-surface border-hair border-line bg-surface p-gutter shadow-card',
        className,
      )}
    >
      {tone !== 'default' && (
        <span
          className={cn('absolute inset-y-0 left-0 w-[3px]', tone === 'primary' ? 'bg-primary' : 'bg-accent')}
          aria-hidden
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-step--1 font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <p className="tabular mt-2 text-step-3 font-semibold text-ink">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-step--1 font-medium',
              isGood ? 'text-success' : 'text-danger',
            )}
          >
            {isUp ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
            <span className="tabular">{Math.abs(delta.value).toFixed(1)}%</span>
          </span>
        )}
        {hint && <span className="text-step--1 text-ink-muted">{hint}</span>}
      </div>
    </div>
  );
}

/** A tight label/value pair for detail panels. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-step-0 text-ink-muted">{label}</dt>
      <dd className="text-step-0 text-right font-medium text-ink">{children}</dd>
    </div>
  );
}
