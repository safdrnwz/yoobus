/**
 * Pure, testable document/validity expiry helpers. Single home for any "valid until"
 * checks (driver licences, police verification, insurance, permits, pollution certs).
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isExpired(expiryMs: number, nowMs: number): boolean {
  return nowMs > expiryMs;
}

export function daysToExpiry(expiryMs: number, nowMs: number): number {
  return Math.ceil((expiryMs - nowMs) / MS_PER_DAY);
}

/** True when the document is still valid but within the warning window. */
export function isExpiringSoon(expiryMs: number, nowMs: number, warningDays = 30): boolean {
  if (isExpired(expiryMs, nowMs)) return false;
  return daysToExpiry(expiryMs, nowMs) <= warningDays;
}

/** A set of documents is compliant only when every one is unexpired. */
export function allValid(expiries: number[], nowMs: number): boolean {
  return expiries.every((e) => !isExpired(e, nowMs));
}
