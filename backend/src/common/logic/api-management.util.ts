/**
 * Pure, testable rules for the SuperAdmin API Management module: partner lifecycle,
 * API key usability, scopes, webhook HMAC signatures, per-partner rate-limit checks,
 * and API version status.
 *
 * Global request throttling already exists (ThrottlerModule) and is NOT duplicated here;
 * this module only stores and evaluates per-partner limit configuration.
 */
import { createHmac } from 'crypto';

export type PartnerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type ApiVersionStatus = 'ACTIVE' | 'DEPRECATED' | 'RETIRED';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

const PARTNER_TRANSITIONS: Record<PartnerStatus, PartnerStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUSPENDED'],
  SUSPENDED: ['APPROVED'],
  REJECTED: [],
};

export function partnerCanTransition(from: PartnerStatus, to: PartnerStatus): InvariantResult {
  if (!PARTNER_TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'PARTNER_INVALID_TRANSITION', message: `A partner cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}

/** A key is usable only when ACTIVE and not past its expiry. */
export function canUseApiKey(status: ApiKeyStatus, expiresAtMs: number | null, nowMs: number): InvariantResult {
  if (status === 'REVOKED') return { ok: false, code: 'API_KEY_REVOKED', message: 'This API key has been revoked.' };
  if (status === 'EXPIRED') return { ok: false, code: 'API_KEY_EXPIRED', message: 'This API key has expired.' };
  if (expiresAtMs !== null && nowMs >= expiresAtMs) return { ok: false, code: 'API_KEY_EXPIRED', message: 'This API key has expired.' };
  return { ok: true };
}

/** Masks a raw key for display: keeps the prefix and last four characters. */
export function maskApiKey(rawKey: string): string {
  if (rawKey.length <= 8) return '****';
  const lastFour = rawKey.slice(-4);
  const prefix = rawKey.slice(0, rawKey.indexOf('_') + 1 || 4);
  return `${prefix}****${lastFour}`;
}

/** True when every required scope is present in the granted scopes. */
export function hasScopes(granted: string[], required: string[]): boolean {
  return required.every((scope) => granted.includes(scope));
}

/** Computes an HMAC-SHA256 hex signature for a webhook payload. */
export function computeWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(payload: string, secret: string, signature: string): boolean {
  const expected = computeWebhookSignature(payload, secret);
  // Constant-time-ish comparison on equal-length hex strings.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** Per-partner fixed-window rate-limit check (configuration-level, not the global guard). */
export function withinRateLimit(usedInWindow: number, limitPerWindow: number): boolean {
  return usedInWindow < limitPerWindow;
}

/** Whether a fixed window has elapsed and the counter should reset. */
export function rateLimitWindowExpired(windowStartMs: number, windowMs: number, nowMs: number): boolean {
  return nowMs - windowStartMs >= windowMs;
}

export function isVersionUsable(status: ApiVersionStatus): InvariantResult {
  if (status === 'RETIRED') return { ok: false, code: 'API_VERSION_RETIRED', message: 'This API version has been retired.' };
  return { ok: true };
}

/** Retry policy: allow a retry while attempts remain, using exponential backoff seconds. */
export function shouldRetryWebhook(attempts: number, maxAttempts: number): boolean {
  return attempts < maxAttempts;
}
export function backoffSeconds(attempt: number): number {
  return Math.min(3600, Math.pow(2, attempt) * 5); // 5s, 10s, 20s ... capped at 1h
}
