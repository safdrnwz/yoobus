/** Pure, testable auth security helpers: password policy and token expiry. */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }

/** Password must be at least 8 chars with at least one letter and one digit. */
export function isStrongPassword(pw: string): boolean {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

export function validatePassword(pw: string): InvariantResult {
  if (!isStrongPassword(pw)) {
    return { ok: false, code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters and include a letter and a number.' };
  }
  return { ok: true };
}

/** A token is expired when now is past its expiry. */
export function tokenExpired(expiryMs: number, nowMs: number): boolean {
  return nowMs >= expiryMs;
}

/** A refresh token is usable only when unexpired and not revoked. */
export function refreshTokenUsable(expiryMs: number, nowMs: number, revoked: boolean): InvariantResult {
  if (revoked) return { ok: false, code: 'REFRESH_REVOKED', message: 'This session has been revoked. Please sign in again.' };
  if (tokenExpired(expiryMs, nowMs)) return { ok: false, code: 'REFRESH_EXPIRED', message: 'Your session has expired. Please sign in again.' };
  return { ok: true };
}
