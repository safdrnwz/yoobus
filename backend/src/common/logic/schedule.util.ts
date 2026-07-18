/**
 * Pure, testable rules for operator trip schedules:
 * weekly recurrence matching and seasonal (date-range) activeness.
 */
export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

// 0 = Sunday ... 6 = Saturday (UTC).
export function dayOfWeek(ms: number): number {
  return new Date(ms).getUTCDay();
}

/** True when the given date falls on one of the schedule's recurring weekdays. */
export function isScheduledOn(daysOfWeek: number[], dateMs: number): boolean {
  return daysOfWeek.includes(dayOfWeek(dateMs));
}

export function validateDaysOfWeek(days: number[]): InvariantResult {
  if (!Array.isArray(days) || days.length === 0) {
    return { ok: false, code: 'SCHEDULE_NO_DAYS', message: 'At least one day of the week is required.' };
  }
  if (days.some((d) => d < 0 || d > 6 || !Number.isInteger(d))) {
    return { ok: false, code: 'SCHEDULE_INVALID_DAY', message: 'Days of week must be integers from 0 (Sunday) to 6 (Saturday).' };
  }
  return { ok: true };
}

/** A seasonal schedule is active only within its [start, end] window (inclusive). */
export function isSeasonActive(startMs: number, endMs: number, nowMs: number): boolean {
  return nowMs >= startMs && nowMs <= endMs;
}

/** Validates that a season window is well-formed. */
export function validateSeason(startMs: number, endMs: number): InvariantResult {
  if (endMs < startMs) {
    return { ok: false, code: 'SCHEDULE_BAD_SEASON', message: 'The season end date must be on or after the start date.' };
  }
  return { ok: true };
}
