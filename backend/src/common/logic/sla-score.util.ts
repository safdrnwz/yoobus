/** Pure, testable operator SLA score (0..100) from service-quality signals. */
export interface SlaInputs {
  avgRating: number;             // 0..5
  tripCancellationRate: number;  // 0..1
  bookingCancellationRate: number; // 0..1
  disruptionRate: number;        // disruptions / trips, 0..1+
  majorIncidents: number;        // count
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function computeSlaScore(i: SlaInputs): number {
  const rating = clamp01((i.avgRating || 0) / 5) * 40;
  const tripRel = (1 - clamp01(i.tripCancellationRate)) * 25;
  const bookingRel = (1 - clamp01(i.bookingCancellationRate)) * 15;
  const disruption = (1 - clamp01(i.disruptionRate)) * 20;
  const majorPenalty = Math.min(15, (i.majorIncidents || 0) * 3);
  const score = rating + tripRel + bookingRel + disruption - majorPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** A friendly grade for the score. */
export function slaGrade(score: number): string {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'NEEDS_IMPROVEMENT';
}
