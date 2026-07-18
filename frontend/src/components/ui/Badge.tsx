import type { ReactNode } from 'react';
import { cn } from '@/core/utils/cn';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted border-line',
  primary: 'bg-primary-soft text-primary border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  accent: 'bg-accent-soft text-accent border-transparent',
};

export function Badge({
  children,
  tone = 'neutral',
  dot,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border-hair px-2 py-0.5 text-step--1 font-medium',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Every status the backend can return, mapped to a tone once. Screens pass the raw status
 * string; the colour logic lives here so a "CANCELLED" booking looks the same everywhere.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success', CONFIRMED: 'success', PAID: 'success', COMPLETED: 'success', APPROVED: 'success',
  RESOLVED: 'success', VERIFIED: 'success', SUCCESS: 'success', CLOSED: 'neutral', BOARDED: 'success',
  PENDING: 'warning', HELD: 'warning', IN_PROGRESS: 'warning', PROCESSING: 'warning', TRIAL: 'warning',
  SCHEDULED: 'info', OPEN: 'info', DRAFT: 'neutral', NEW: 'info', RUNNING: 'info',
  CANCELLED: 'danger', FAILED: 'danger', REJECTED: 'danger', SUSPENDED: 'danger', EXPIRED: 'danger',
  NO_SHOW: 'danger', BLOCKED: 'danger', OVERDUE: 'danger', VOID: 'danger',
  INACTIVE: 'neutral', ARCHIVED: 'neutral',
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-ink-faint">—</span>;
  const key = status.toUpperCase();
  const tone = STATUS_TONES[key] ?? 'neutral';
  const label = key
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}
