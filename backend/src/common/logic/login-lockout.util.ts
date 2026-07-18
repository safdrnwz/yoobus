/** Pure, testable brute-force lockout rules for login. */
export interface LockState { failedCount: number; lockedUntilMs: number | null; }

/** True when the account is currently locked. */
export function isLocked(lockedUntilMs: number | null, nowMs: number): boolean {
  return lockedUntilMs !== null && nowMs < lockedUntilMs;
}

/** Remaining lock time in seconds (0 if not locked). */
export function lockRemainingSec(lockedUntilMs: number | null, nowMs: number): number {
  if (!isLocked(lockedUntilMs, nowMs)) return 0;
  return Math.ceil(((lockedUntilMs as number) - nowMs) / 1000);
}

/** Computes the next lock state after a failed attempt. */
export function afterFailure(current: LockState, nowMs: number, maxAttempts: number, lockMinutes: number): LockState {
  // A lapsed lock resets the counter before counting this failure.
  const base = isLocked(current.lockedUntilMs, nowMs) ? current.failedCount : (current.lockedUntilMs && nowMs >= current.lockedUntilMs ? 0 : current.failedCount);
  const failedCount = base + 1;
  if (failedCount >= maxAttempts) {
    return { failedCount, lockedUntilMs: nowMs + lockMinutes * 60 * 1000 };
  }
  return { failedCount, lockedUntilMs: null };
}

/** State after a successful login (fully cleared). */
export function afterSuccess(): LockState {
  return { failedCount: 0, lockedUntilMs: null };
}
