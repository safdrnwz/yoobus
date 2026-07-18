/**
 * Pure, testable rules for connecting-journey (multi-origin / through-service) search.
 * A connection is two legs (leg A ends at a hub, leg B starts at that hub) on the same
 * service day, where leg B departs after leg A arrives plus a minimum layover.
 */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }

/** "HH:mm" -> minutes from midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Arrival time (minutes from the service day's midnight) at a stop with a known offset. */
export function arrivalMinutes(departHHmm: string, arrivalOffsetMin: number): number {
  return timeToMinutes(departHHmm) + arrivalOffsetMin;
}

/** Layover between arriving at the hub on leg A and departing on leg B. */
export function layoverMinutes(arriveHubMin: number, departHubMin: number): number {
  return departHubMin - arriveHubMin;
}

/** A connection is valid when the layover is within [min, max]. */
export function isValidConnection(arriveHubMin: number, departHubMin: number, minLayover = 20, maxLayover = 360): InvariantResult {
  const gap = layoverMinutes(arriveHubMin, departHubMin);
  if (gap < minLayover) return { ok: false, code: 'CONNECTION_TOO_TIGHT', message: `Layover of ${gap} min is below the ${minLayover} min minimum.` };
  if (gap > maxLayover) return { ok: false, code: 'CONNECTION_TOO_LONG', message: `Layover of ${gap} min exceeds the ${maxLayover} min maximum.` };
  return { ok: true };
}
