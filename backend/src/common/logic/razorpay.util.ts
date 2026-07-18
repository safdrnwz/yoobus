import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Pure, testable Razorpay signature verification.
 * signature = HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET)
 */
export function expectedSignature(orderId: string, paymentId: string, secret: string): string {
  return createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = expectedSignature(orderId, paymentId, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Amount to paise (Razorpay's smallest unit). Enforces the 100-paise minimum. */
export function toPaise(rupees: number): number {
  const paise = Math.round(rupees * 100);
  return paise < 100 ? 0 : paise;
}
