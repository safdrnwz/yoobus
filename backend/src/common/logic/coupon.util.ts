/** Pure, testable coupon/promo rules. */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }
export type CouponType = 'PERCENT' | 'FLAT';
function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Discount for a fare, honoring percent/flat, a max cap, and never exceeding the fare. */
export function computeCouponDiscount(fare: number, type: CouponType, value: number, maxDiscount?: number | null): number {
  if (fare <= 0 || value <= 0) return 0;
  let d = type === 'PERCENT' ? (fare * value) / 100 : value;
  if (maxDiscount != null && maxDiscount > 0) d = Math.min(d, maxDiscount);
  d = Math.min(d, fare);
  return round2(Math.max(0, d));
}

export interface CouponState {
  active: boolean;
  validFromMs?: number | null;
  validToMs?: number | null;
  minFare?: number | null;
  usageLimit?: number | null;   // total redemptions allowed
  usedCount: number;
  perUserLimit?: number | null; // per-user redemptions allowed
  userUsedCount: number;
  type: CouponType;
  value: number;
}

/** Full eligibility check for applying a coupon to a fare at a moment in time. */
export function validateCoupon(c: CouponState, fare: number, nowMs: number): InvariantResult {
  if (!c.active) return { ok: false, code: 'COUPON_INACTIVE', message: 'This coupon is not active.' };
  if (c.validFromMs != null && nowMs < c.validFromMs) return { ok: false, code: 'COUPON_NOT_STARTED', message: 'This coupon is not valid yet.' };
  if (c.validToMs != null && nowMs > c.validToMs) return { ok: false, code: 'COUPON_EXPIRED', message: 'This coupon has expired.' };
  if (c.minFare != null && fare < c.minFare) return { ok: false, code: 'COUPON_MIN_FARE', message: `A minimum fare of ${c.minFare} is required for this coupon.` };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { ok: false, code: 'COUPON_EXHAUSTED', message: 'This coupon has reached its usage limit.' };
  if (c.perUserLimit != null && c.userUsedCount >= c.perUserLimit) return { ok: false, code: 'COUPON_USER_LIMIT', message: 'You have already used this coupon the maximum number of times.' };
  if (computeCouponDiscount(fare, c.type, c.value, null) <= 0) return { ok: false, code: 'COUPON_NO_BENEFIT', message: 'This coupon gives no discount on this fare.' };
  return { ok: true };
}
