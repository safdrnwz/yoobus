import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Button } from './Button';
import { ApiError } from '@/core/api/api-error';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-ink-muted', className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-control bg-surface-sunken', className)} aria-hidden />;
}

/** The placeholder a table shows while its first page is loading. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-gutter">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton key={columnIndex} className={cn('h-4 flex-1', columnIndex === 0 && 'max-w-[140px]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

const ALERT_TONES = {
  info: { className: 'border-info/30 bg-info-soft text-info', Icon: Info },
  success: { className: 'border-success/30 bg-success-soft text-success', Icon: CheckCircle2 },
  warning: { className: 'border-warning/30 bg-warning-soft text-warning', Icon: AlertTriangle },
  danger: { className: 'border-danger/30 bg-danger-soft text-danger', Icon: AlertCircle },
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT_TONES;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = ALERT_TONES[tone];
  return (
    <div className={cn('flex items-start gap-3 rounded-surface border-hair px-4 py-3', toneClass, className)} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="text-step-0 font-medium">{title}</p>}
        {children && <div className="text-step--1 opacity-90">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/**
 * An empty screen is an invitation to act, so it always offers the next step rather than
 * just announcing that there's nothing here.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-surface bg-surface-sunken text-ink-faint">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </div>
      <h3 className="text-step-1 text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-step-0 text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Failure states say what went wrong and how to fix it. A 403 is not a crash, so it gets
 * its own copy rather than a generic "something went wrong".
 */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const apiError = error instanceof ApiError ? error : null;
  const isForbidden = apiError?.isForbidden ?? false;

  const title = isForbidden
    ? 'You do not have access to this'
    : apiError?.status === 0
      ? 'No connection'
      : 'That did not load';

  const description = isForbidden
    ? 'Ask a platform administrator to grant you the permission for this area.'
    : (apiError?.message ?? 'Try again in a moment.');

  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-surface bg-danger-soft text-danger">
        <AlertCircle className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-step-1 text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-step-0 text-ink-muted">{description}</p>
      {apiError?.correlationId && (
        <p className="tabular mt-2 text-step--1 text-ink-faint">Reference {apiError.correlationId}</p>
      )}
      {onRetry && !isForbidden && (
        <Button variant="outline" className="mt-5" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
