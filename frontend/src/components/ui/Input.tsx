import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/core/utils/cn';

const FIELD_BASE =
  'w-full rounded-control border-hair border-line bg-surface px-3 text-step-0 text-ink ' +
  'placeholder:text-ink-faint transition-colors duration-motion ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20';

export interface FieldProps {
  label?: string;
  /** Shown under the field when things are fine. Replaced by the error when they aren't. */
  hint?: string;
  error?: string;
  required?: boolean;
}

/** Wraps any control with its label, hint and error, so every form reads the same. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: FieldProps & { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-step--1 font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-step--1 text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-step--1 text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, leftIcon, rightSlot, className, containerClassName, id, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId} className={containerClassName}>
      <div className="relative flex items-center">
        {leftIcon && <span className="pointer-events-none absolute left-3 text-ink-faint">{leftIcon}</span>}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          className={cn(FIELD_BASE, 'h-[var(--control-height)]', leftIcon && 'pl-9', rightSlot && 'pr-10', className)}
          {...props}
        />
        {rightSlot && <span className="absolute right-2 flex items-center">{rightSlot}</span>}
      </div>
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, id, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={props.rows ?? 4}
        aria-invalid={Boolean(error)}
        className={cn(FIELD_BASE, 'resize-y py-2', className)}
        {...props}
      />
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, placeholder, className, containerClassName, id, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId} className={containerClassName}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        className={cn(FIELD_BASE, 'h-[var(--control-height)] cursor-pointer appearance-none pr-8', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235F6B64' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
});

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, description, disabled, id }: SwitchProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-step-0 font-medium text-ink">{label}</span>}
          {description && <span className="text-step--1 text-ink-muted">{description}</span>}
        </span>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-pill transition-colors duration-motion',
          checked ? 'bg-primary' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-pill bg-white shadow transition-transform duration-motion',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <label htmlFor={fieldId} className="flex cursor-pointer items-center gap-2 text-step-0 text-ink">
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className={cn(
          'h-4 w-4 cursor-pointer rounded border-hair border-line-strong text-primary',
          'focus:ring-2 focus:ring-primary/20',
          className,
        )}
        {...props}
      />
      {label}
    </label>
  );
});
