import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

function coerce(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : typeof value === 'number' ? new Date(value) : parseISO(value);
  return isValid(date) ? date : null;
}

export function formatDate(value: string | number | Date | null | undefined, pattern = 'dd MMM yyyy'): string {
  const date = coerce(value);
  return date ? format(date, pattern) : '—';
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  return formatDate(value, 'dd MMM yyyy, HH:mm');
}

export function formatTime(value: string | number | Date | null | undefined): string {
  return formatDate(value, 'HH:mm');
}

/** "3 hours ago" — for audit trails and activity feeds. */
export function formatRelative(value: string | number | Date | null | undefined): string {
  const date = coerce(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : '—';
}

/** The value an <input type="date"> expects. */
export function toDateInput(value: string | number | Date | null | undefined): string {
  const date = coerce(value);
  return date ? format(date, 'yyyy-MM-dd') : '';
}

export function todayInput(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Minutes between two instants — used for trip duration and hold windows. */
export function durationMinutes(from: string | Date, to: string | Date): number | null {
  const a = coerce(from);
  const b = coerce(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = Math.abs(minutes % 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}
