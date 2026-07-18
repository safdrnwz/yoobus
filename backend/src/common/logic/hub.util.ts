/** Pure, testable hub-and-spoke rules. */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }
export type HubPosition = 'ORIGIN' | 'DESTINATION' | 'INTERMEDIATE';

/** Where the hub sits on a spoke route, given the hub's stop order and the route bounds. */
export function classifyHubPosition(hubOrder: number, firstOrder: number, lastOrder: number): HubPosition {
  if (hubOrder <= firstOrder) return 'ORIGIN';
  if (hubOrder >= lastOrder) return 'DESTINATION';
  return 'INTERMEDIATE';
}

/** A route can be a spoke of a hub only if it actually passes through the hub's stop. */
export function validateSpoke(routeStopIds: string[], hubStopId: string): InvariantResult {
  if (!routeStopIds.includes(hubStopId)) {
    return { ok: false, code: 'SPOKE_MISSING_HUB', message: 'This route does not pass through the hub stop.' };
  }
  return { ok: true };
}
