// OTP policy: pure and testable. Generation is random, but the verification logic is pure.
export interface OtpState {
  codeHash: string;       // hashed otp
  expiresAt: number;      // epoch ms
  attempts: number;       // failed attempts so far
  lastSentAt: number;     // epoch ms
}
export const OTP_MAX_ATTEMPTS = 5;
export { OTP_TTL_MS } from '../config/platform-defaults';
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30s

export function canResend(state: OtpState | null, now: number): { ok: boolean; waitMs: number } {
  if (!state) return { ok: true, waitMs: 0 };
  const elapsed = now - state.lastSentAt;
  if (elapsed >= OTP_RESEND_COOLDOWN_MS) return { ok: true, waitMs: 0 };
  return { ok: false, waitMs: OTP_RESEND_COOLDOWN_MS - elapsed };
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; code: 'OTP_EXPIRED' | 'OTP_MAX_ATTEMPTS' | 'OTP_INVALID'; message: string };

export function verifyOtp(state: OtpState | null, providedHash: string, now: number): OtpVerifyResult {
  if (!state) return { ok: false, code: 'OTP_INVALID', message: 'No OTP request found' };
  if (now > state.expiresAt) return { ok: false, code: 'OTP_EXPIRED', message: 'OTP has expired' };
  if (state.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, code: 'OTP_MAX_ATTEMPTS', message: 'Too many invalid attempts' };
  if (state.codeHash !== providedHash) return { ok: false, code: 'OTP_INVALID', message: 'OTP is incorrect' };
  return { ok: true };
}
