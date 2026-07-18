/**
 * Dynamic pricing engine (Phase 3). Pure and deterministic so it is fully testable.
 * Final multiplier = demand factor x time-to-departure factor x day-of-week factor,
 * clamped to a configurable [min, max] band so prices never run away.
 */
export interface PricingFactors {
  occupancyRatio: number; // 0..1 (seats sold / total)
  hoursToDeparture: number; // hours remaining before departure
  isWeekend: boolean;
}

export interface PricingConfig {
  minMultiplier: number;
  maxMultiplier: number;
  weekendSurcharge: number; // e.g. 0.10 => +10%
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  minMultiplier: 0.8,
  maxMultiplier: 2.0,
  weekendSurcharge: 0.1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function demandMultiplier(occupancyRatio: number): number {
  const r = clamp(occupancyRatio, 0, 1);
  // 0% sold => 1.0, 100% sold => 1.5 (linear)
  return 1 + r * 0.5;
}

export function urgencyMultiplier(hoursToDeparture: number): number {
  if (hoursToDeparture <= 6) return 1.25;
  if (hoursToDeparture <= 24) return 1.1;
  if (hoursToDeparture <= 72) return 1.0;
  return 0.95; // early-bird discount
}

export function computePriceMultiplier(
  factors: PricingFactors,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): number {
  let m = demandMultiplier(factors.occupancyRatio) * urgencyMultiplier(factors.hoursToDeparture);
  if (factors.isWeekend) m *= 1 + cfg.weekendSurcharge;
  return Math.round(clamp(m, cfg.minMultiplier, cfg.maxMultiplier) * 100) / 100;
}
