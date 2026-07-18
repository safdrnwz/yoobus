import type { ReactNode } from 'react';
import { cn } from '@/core/utils/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto border-b border-line', className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-step-0 transition-colors duration-motion',
              isActive ? 'font-medium text-primary' : 'text-ink-muted hover:text-ink',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-pill px-1.5 py-0.5 text-step--1',
                  isActive ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-ink-muted',
                )}
              >
                {tab.count}
              </span>
            )}
            {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
