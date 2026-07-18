import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/core/utils/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-surface border-hair border-line bg-surface shadow-card', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-gutter py-4', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-step-1 text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-step--1 text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-gutter', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-line bg-surface-sunken px-gutter py-3', className)}
      {...props}
    />
  );
}
