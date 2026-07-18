/**
 * Fleet capacity rule: how many drivers an operator may hold, derived from fleet size.
 *
 * This used to live in plan-entitlements.ts. It is NOT a plan concept — it is a physical fleet
 * ratio — so it survives the removal of plans and now lives on its own.
 */
export const DRIVER_PER_BUS = 2.5;

/** round(buses * 2.5). */
export function driverLimitForBuses(busCount: number): number {
  return Math.round(busCount * DRIVER_PER_BUS);
}
