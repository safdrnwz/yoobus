/** Pure, testable dynamic-fare engine (surge by demand + urgency). */
function round2(n: number): number { return Math.round(n * 100) / 100; }

export interface DynamicFareInput {
  occupancyPct: number;      // 0..1  seats sold / total
  daysToDeparture: number;   // whole days until departure (0 = today)
  baseMultiplier?: number;   // the trip's own multiplier (default 1)
  hour?: number;             // 0..23 local departure hour (peak surcharge)
}

const MAX_MULTIPLIER = 2.0;
const MIN_MULTIPLIER = 0.8;

/**
 * Occupancy drives most of the surge; urgency and peak hours add a little.
 * Result is clamped to a sane band so fares never explode.
 */
export function dynamicFareMultiplier(input: DynamicFareInput): number {
  const base = input.baseMultiplier ?? 1;
  let m = base;

  const occ = Math.max(0, Math.min(1, input.occupancyPct));
  if (occ >= 0.9) m += 0.5;
  else if (occ >= 0.7) m += 0.3;
  else if (occ >= 0.5) m += 0.15;
  else if (occ <= 0.2) m -= 0.1; // gentle discount to fill empty buses

  const d = input.daysToDeparture;
  if (d <= 0) m += 0.25;
  else if (d <= 1) m += 0.2;
  else if (d <= 3) m += 0.1;
  else if (d >= 21) m -= 0.05; // early-bird

  if (input.hour !== undefined && (input.hour >= 6 && input.hour <= 9)) m += 0.05; // morning peak

  return round2(Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, m)));
}

/** Applies the dynamic multiplier to a base (per-seat) fare that already had the base multiplier. */
export function applyDynamicFare(baseFarePerSeat: number, baseMultiplier: number, dynamicMultiplier: number): number {
  if (baseMultiplier <= 0) return round2(baseFarePerSeat);
  const unit = baseFarePerSeat / baseMultiplier; // strip the base multiplier
  return round2(unit * dynamicMultiplier);
}
