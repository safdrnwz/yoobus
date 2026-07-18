/** Pure, testable seat-upgrade rules. */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }

// Seat category ranking; a higher rank is an upgrade.
const RANK: Record<string, number> = { SEATER: 1, SEMI_SLEEPER: 2, SLEEPER: 3 };

export function categoryRank(category: string): number {
  return RANK[category] ?? 0;
}

export function isUpgrade(from: string, to: string): boolean {
  return categoryRank(to) > categoryRank(from);
}

/** Fare difference for a paid upgrade, never negative. Complimentary upgrades charge 0. */
export function upgradeFareDifference(fromPrice: number, toPrice: number, complimentary: boolean): number {
  if (complimentary) return 0;
  return Math.max(0, Math.round((toPrice - fromPrice) * 100) / 100);
}

export function canOfferUpgrade(bookingStatus: string, from: string, to: string): InvariantResult {
  if (bookingStatus !== 'CONFIRMED') return { ok: false, code: 'UPGRADE_BOOKING_NOT_CONFIRMED', message: 'Only a confirmed booking can be upgraded.' };
  if (!isUpgrade(from, to)) return { ok: false, code: 'UPGRADE_NOT_HIGHER', message: 'The target seat category is not an upgrade.' };
  return { ok: true };
}
