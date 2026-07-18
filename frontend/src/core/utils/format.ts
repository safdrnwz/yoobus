/**
 * Presentation helpers. Currency and dates are formatted here and nowhere else, so a
 * change to the platform's locale settings lands everywhere at once.
 */
let currency = 'INR';
let locale = 'en-IN';

/** Called once the LOCALIZATION settings arrive from the API. */
export function configureFormatting(next: { currency?: string; locale?: string }): void {
  if (next.currency) currency = next.currency;
  if (next.locale) locale = next.locale;
}

export function formatMoney(value: number | string | null | undefined, options?: { compact?: boolean }): string {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: options?.compact ? 'compact' : 'standard',
    maximumFractionDigits: options?.compact ? 1 : 2,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Turns SCREAMING_SNAKE_CASE codes into something a person would say out loud. */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function truncate(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
