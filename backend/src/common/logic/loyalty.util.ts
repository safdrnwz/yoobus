/** Pure, testable loyalty rules: referral rewards + points earn/redeem. */
function round2(n: number): number { return Math.round(n * 100) / 100; }

export interface ReferralConfig { referrerReward: number; refereeReward: number; }
export function referralRewards(cfg: ReferralConfig) {
  return { referrer: round2(cfg.referrerReward), referee: round2(cfg.refereeReward) };
}

/** Points earned for a booking = floor(amount * rate). */
export function pointsForBooking(amount: number, pointsPerRupee: number): number {
  if (amount <= 0 || pointsPerRupee <= 0) return 0;
  return Math.floor(amount * pointsPerRupee);
}

/** Rupee value of points at a conversion rate (e.g. 0.25 => 1 point = 0.25 INR). */
export function pointsValue(points: number, rupeePerPoint: number): number {
  if (points <= 0 || rupeePerPoint <= 0) return 0;
  return round2(points * rupeePerPoint);
}

/** A user cannot redeem their own referral code. */
export function canRedeemReferral(ownerUserId: string, refereeUserId: string): { ok: boolean; code?: string; message?: string } {
  if (ownerUserId === refereeUserId) return { ok: false, code: 'SELF_REFERRAL', message: 'You cannot use your own referral code.' };
  return { ok: true };
}
