/**
 * Pure, testable fuel calculations for fleet cost optimization.
 */
function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Fuel efficiency in kilometers per litre. */
export function mileage(distanceKm: number, litres: number): number {
  if (litres <= 0) return 0;
  return round2(distanceKm / litres);
}

/** Total fuel cost. */
export function fuelCost(litres: number, pricePerLitre: number): number {
  return round2(litres * pricePerLitre);
}

/**
 * Variance of actual mileage against a benchmark, as a signed percentage.
 * Negative means worse than benchmark (potential leak/theft signal).
 */
export function efficiencyVariancePct(actualMileage: number, benchmarkMileage: number): number {
  if (benchmarkMileage <= 0) return 0;
  return round2(((actualMileage - benchmarkMileage) / benchmarkMileage) * 100);
}
