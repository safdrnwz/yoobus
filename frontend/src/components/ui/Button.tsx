import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useAppearance } from '@/theme/ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'soft' | 'ghost' | 'danger';
export type ButtonSizeProp = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSizeProp;
  /** Shows a spinner and blocks the click, so a slow save can't be double-submitted. */
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

/**
 * The button's default look is not hard-coded — it comes from Global Settings. An admin
 * who sets the house style to "outline pills" changes every primary button in the product
 * without anyone editing a component.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover border-transparent',
  secondary: 'bg-secondary text-secondary-fg hover:opacity-90 border-transparent',
  accent: 'bg-accent text-accent-fg hover:opacity-90 border-transparent',
  outline: 'bg-transparent text-ink border-line-strong hover:bg-surface-sunken',
  soft: 'bg-primary-soft text-primary border-transparent hover:brightness-95',
  ghost: 'bg-transparent text-ink-muted border-transparent hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90 border-transparent',
};

const SIZES: Record<ButtonSizeProp, string> = {
  sm: 'h-8 px-3 text-step--1',
  md: 'h-[var(--button-height)] text-step-0',
  lg: 'h-11 px-6 text-step-1',
  icon: 'h-[var(--button-height)] w-[var(--button-height)] p-0',
};

/** Maps the admin's global button style onto our variant names. */
const GLOBAL_VARIANT: Record<string, ButtonVariant> = {
  SOLID: 'primary',
  OUTLINE: 'outline',
  SOFT: 'soft',
  GHOST: 'ghost',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size = 'md', isLoading, leftIcon, rightIcon, fullWidth, className, children, disabled, ...props },
  ref,
) {
  const appearance = useAppearance();
  // No explicit variant means "use the house style the admin configured".
  const resolved = variant ?? GLOBAL_VARIANT[appearance.buttonVariant] ?? 'primary';

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control border-hair',
        'transition-colors duration-motion',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[resolved],
        SIZES[size],
        size === 'md' && 'px-[16px]',
        fullWidth && 'w-full',
        className,
      )}
      style={{
        fontWeight: 'var(--button-weight)',
        textTransform: 'var(--button-transform)' as never,
        letterSpacing: 'var(--button-tracking)',
      }}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});

/** A square button that holds only an icon. Always needs a label for screen readers. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { label, className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      size="icon"
      variant={props.variant ?? 'ghost'}
      aria-label={label}
      title={label}
      className={cn('shrink-0', className)}
      {...props}
    />
  );
});
