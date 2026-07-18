import { useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { contrastRatio } from '@/theme/apply-theme';

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * A colour input that tells the truth about its choice.
 *
 * An admin picking a brand colour cannot be expected to know WCAG ratios, so when a
 * colour would leave text unreadable against the surface it sits on, the field says so
 * — while still letting them save it, because a house brand is their call, not ours.
 */
export function ColorField({
  label,
  value,
  onChange,
  description,
  /** The colour this one will be seen against, used for the contrast warning. */
  contrastAgainst,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  contrastAgainst?: string;
  className?: string;
}) {
  const id = useId();
  const isValid = HEX_PATTERN.test(value);

  const ratio = isValid && contrastAgainst ? contrastRatio(value, contrastAgainst) : null;
  // 4.5:1 is the WCAG AA threshold for body text.
  const isLowContrast = ratio !== null && ratio < 4.5;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-step--1 font-medium text-ink">
        {label}
      </label>

      <div className="flex items-center gap-2">
        <div className="relative h-[var(--control-height)] w-11 shrink-0 overflow-hidden rounded-control border-hair border-line">
          <input
            id={id}
            type="color"
            value={isValid ? value : '#000000'}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0"
            aria-label={`${label} colour picker`}
          />
        </div>

        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          spellCheck={false}
          aria-invalid={!isValid}
          className={cn(
            'tabular h-[var(--control-height)] w-full rounded-control border-hair bg-surface px-3 text-step-0 uppercase text-ink',
            'focus:outline-none focus:ring-2 focus:ring-primary/20',
            isValid ? 'border-line focus:border-primary' : 'border-danger',
          )}
        />
      </div>

      {!isValid ? (
        <p className="text-step--1 text-danger">Enter a hex colour, such as #0E6E56.</p>
      ) : isLowContrast ? (
        <p className="flex items-center gap-1 text-step--1 text-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          Contrast {ratio!.toFixed(1)}:1 — text on this colour will be hard to read.
        </p>
      ) : description ? (
        <p className="text-step--1 text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}

/** A labelled slider for the numeric design tokens (radius, font size, spacing). */
export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'px',
  description,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-step--1 font-medium text-ink">
          {label}
        </label>
        <span className="tabular text-step--1 text-ink-muted">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-line accent-[var(--color-primary)]"
      />
      {description && <p className="text-step--1 text-ink-muted">{description}</p>}
    </div>
  );
}

/** A segmented control — the right shape for a small, mutually exclusive choice. */
export function SegmentedField<T extends string>({
  label,
  value,
  onChange,
  options,
  description,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-step--1 font-medium text-ink">{label}</span>
      <div className="inline-flex rounded-control border-hair border-line bg-surface-sunken p-0.5" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex-1 whitespace-nowrap rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-step--1 transition-colors duration-motion',
                isActive ? 'bg-surface font-medium text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {description && <p className="text-step--1 text-ink-muted">{description}</p>}
    </div>
  );
}
