/** Pure, testable demand forecasting rules. */
export type DemandLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Classifies demand from a predicted occupancy ratio (0..1). */
export function demandLevel(occupancyRatio: number): DemandLevel {
  if (occupancyRatio >= 0.85) return 'HIGH';
  if (occupancyRatio >= 0.5) return 'MEDIUM';
  return 'LOW';
}

export interface ForecastRecommendation {
  addExtraBus: boolean;
  raiseFare: boolean;
  lowerFare: boolean;
}

/** Recommends operational actions based on the forecast demand level. */
export function recommendation(level: DemandLevel): ForecastRecommendation {
  if (level === 'HIGH') return { addExtraBus: true, raiseFare: true, lowerFare: false };
  if (level === 'LOW') return { addExtraBus: false, raiseFare: false, lowerFare: true };
  return { addExtraBus: false, raiseFare: false, lowerFare: false };
}
