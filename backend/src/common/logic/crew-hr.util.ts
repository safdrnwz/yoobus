/**
 * Pure, testable rules for operator crew & HR: leave overlap, roster conflicts,
 * and attendance status.
 */
export interface TimeRange { start: number; end: number; }

/** Two ranges overlap when each starts before the other ends. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** A new leave request conflicts if it overlaps any existing approved leave. */
export function leaveConflicts(existing: TimeRange[], requested: TimeRange): boolean {
  return existing.some((e) => rangesOverlap(e, requested));
}

/** A crew member cannot be rostered onto two overlapping shifts. */
export function rosterConflicts(assignedShifts: TimeRange[], newShift: TimeRange): boolean {
  return assignedShifts.some((s) => rangesOverlap(s, newShift));
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

/** Derives attendance from the actual check-in against the shift start and a grace window. */
export function attendanceStatus(shiftStartMs: number, checkInMs: number | null, graceMinutes = 15): AttendanceStatus {
  if (checkInMs === null) return 'ABSENT';
  if (checkInMs <= shiftStartMs + graceMinutes * 60 * 1000) return 'PRESENT';
  return 'LATE';
}
