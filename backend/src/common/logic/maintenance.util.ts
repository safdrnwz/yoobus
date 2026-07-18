/**
 * Maintenance-window rules (pure, testable).
 * - Duration must be between 30 and 60 minutes.
 * - During an active window, operator-side writes are blocked but passenger booking,
 *   payment, OTP and auth flows continue, all GETs continue, and SuperAdmin bypasses.
 * - Reminders are sent daily starting 7 days before the window start.
 */
export const MIN_MAINTENANCE_MINUTES = 30;
export const MAX_MAINTENANCE_MINUTES = 60;
export const REMINDER_OFFSETS_DAYS = [7, 6, 5, 4, 3, 2, 1];

const MS_PER_MIN = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

export function validateDuration(startMs: number, endMs: number): { ok: boolean; code?: string } {
  const minutes = (endMs - startMs) / MS_PER_MIN;
  if (minutes <= 0) return { ok: false, code: 'MAINTENANCE_INVALID_RANGE' };
  if (minutes < MIN_MAINTENANCE_MINUTES) return { ok: false, code: 'MAINTENANCE_TOO_SHORT' };
  if (minutes > MAX_MAINTENANCE_MINUTES) return { ok: false, code: 'MAINTENANCE_TOO_LONG' };
  return { ok: true };
}

export function isActive(nowMs: number, startMs: number, endMs: number): boolean {
  return nowMs >= startMs && nowMs < endMs;
}

export function isUpcoming(nowMs: number, startMs: number): boolean {
  return nowMs < startMs;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Largest day-offset that is now due and not yet sent (or null if none due).
export function dueReminderOffset(nowMs: number, startMs: number, sent: number[]): number | null {
  if (nowMs >= startMs) return null;
  const sentSet = new Set(sent);
  for (const d of [...REMINDER_OFFSETS_DAYS].sort((a, b) => b - a)) {
    const triggerAt = startMs - d * MS_PER_DAY;
    if (nowMs >= triggerAt && !sentSet.has(d)) return d;
  }
  return null;
}

const ALLOWED_DURING_MAINTENANCE = ['/bookings', '/payments', '/otp', '/auth', '/operators/apply', '/maintenance', '/health', '/tracking'];

export function isWriteBlockedDuringMaintenance(method: string, path: string, role: string | undefined): boolean {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  if (!mutating) return false;
  if (role === 'SUPERADMIN') return false;
  const lower = path.toLowerCase();
  if (ALLOWED_DURING_MAINTENANCE.some((p) => lower.includes(p))) return false;
  return true;
}
