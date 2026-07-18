// Multi-stop segment fare = cumulative(drop) - cumulative(board), * multiplier
export interface RouteStopFare {
  stopId: string;
  stopOrder: number;
  fareFromOrigin: number;
}

export function resolveStopOrder(stops: RouteStopFare[], stopId: string): number {
  const s = stops.find((x) => x.stopId === stopId);
  if (!s) return -1;
  return s.stopOrder;
}

export function segmentFare(
  stops: RouteStopFare[],
  boardingStopId: string,
  droppingStopId: string,
  multiplier = 1,
): number {
  const b = stops.find((x) => x.stopId === boardingStopId);
  const d = stops.find((x) => x.stopId === droppingStopId);
  if (!b || !d) return -1;
  if (b.stopOrder >= d.stopOrder) return -1; // invalid direction
  const fare = (Number(d.fareFromOrigin) - Number(b.fareFromOrigin)) * multiplier;
  return Math.round(fare * 100) / 100;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Per-seat pricing.
 *
 * Until now every seat on a trip cost the same. That is not how buses are sold: a
 * lower berth outsells an upper one, a window outsells an aisle, and the back row is
 * the last thing to go. An operator who cannot price those differently is leaving money
 * on the table on every single departure.
 *
 * The price of a seat is built from three independent things, and keeping them separate
 * is what makes the model work:
 *
 *     fare = segmentFare(route, from → to)   how far you are going
 *          × trip.fareMultiplier             what this departure is worth today
 *          × seat.fareMultiplier             what THIS seat is worth
 *          + seat.fareDelta                  a flat premium, if the operator prices that way
 *
 * The seat multiplier lives on the BUS, not the trip, because seat desirability is a
 * physical property of the vehicle: seat 1A is the front-left window on every trip that
 * bus ever runs. Store it on the trip and you would be re-entering the same map daily.
 *
 * A multiplier, not an absolute price, is the load-bearing choice. An absolute ₹900 for
 * seat 1A is only correct for one segment — the moment someone books Patna→Gaya instead of
 * Patna→Delhi, the number is wrong. A multiplier stays correct at every distance.
 * ──────────────────────────────────────────────────────────────────────────── */

/** What an operator has decided one seat is worth, relative to the others. */
export interface SeatFareRule {
  /** Relative to the base segment fare. 1.15 = 15% dearer than a standard seat. */
  multiplier: number;
  /** A flat amount added after the multiplier, for operators who price berths that way. */
  delta?: number;
}

export type SeatFareMap = Record<string, SeatFareRule>;

/** Bounds. Outside these, someone has made a typo, not a pricing decision. */
export const SEAT_MULTIPLIER_MIN = 0.25;
export const SEAT_MULTIPLIER_MAX = 5;
export const SEAT_DELTA_MIN = -100_000;
export const SEAT_DELTA_MAX = 100_000;

export function isValidSeatFareRule(rule: SeatFareRule): InvariantOk {
  const m = Number(rule.multiplier);
  if (!Number.isFinite(m)) return { ok: false, code: 'SEAT_FARE_INVALID', message: 'Multiplier must be a number.' };
  if (m < SEAT_MULTIPLIER_MIN || m > SEAT_MULTIPLIER_MAX)
    return {
      ok: false,
      code: 'SEAT_FARE_OUT_OF_RANGE',
      message: `Multiplier must be between ${SEAT_MULTIPLIER_MIN} and ${SEAT_MULTIPLIER_MAX}.`,
    };
  const d = Number(rule.delta ?? 0);
  if (!Number.isFinite(d) || d < SEAT_DELTA_MIN || d > SEAT_DELTA_MAX)
    return { ok: false, code: 'SEAT_FARE_OUT_OF_RANGE', message: 'Flat premium is out of range.' };
  return { ok: true };
}

interface InvariantOk {
  ok: boolean;
  code?: string;
  message?: string;
}

/** The price of ONE seat on ONE segment. Everything else is built on this. */
export function seatFare(baseSegmentFare: number, tripMultiplier: number, rule?: SeatFareRule): number {
  const base = baseSegmentFare * (Number(tripMultiplier) || 1);
  const m = rule ? Number(rule.multiplier) : 1;
  const d = rule ? Number(rule.delta ?? 0) : 0;
  const fare = base * (Number.isFinite(m) && m > 0 ? m : 1) + (Number.isFinite(d) ? d : 0);
  return Math.max(0, Math.round(fare * 100) / 100);
}

/** The price of every seat on the bus, for one segment. */
export function seatFares(
  seatNumbers: string[],
  baseSegmentFare: number,
  tripMultiplier: number,
  map: SeatFareMap | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const seat of seatNumbers) out[seat] = seatFare(baseSegmentFare, tripMultiplier, map?.[seat]);
  return out;
}

/**
 * Bulk price change.
 *
 * "Put everything up 5%" is the common case, but it is not the only one: a Monday-morning
 * departure might want the front half dearer and the back row cheaper. So `seats` narrows
 * the change to a subset — omit it and the whole bus moves.
 *
 * `percent` is a CHANGE, not a target: +5 means "5% dearer than it is now", so applying it
 * twice compounds, exactly as an operator would expect. Use `setMultiplier` when you mean
 * "make it exactly this".
 */
export function adjustSeatFares(
  current: SeatFareMap,
  allSeats: string[],
  change: { percent?: number; delta?: number; setMultiplier?: number; seats?: string[] },
): { ok: true; map: SeatFareMap } | { ok: false; code: string; message: string } {
  const target = change.seats?.length ? change.seats : allSeats;

  const unknown = target.filter((s) => !allSeats.includes(s));
  if (unknown.length) {
    return { ok: false, code: 'SEAT_NOT_ON_BUS', message: `Not a seat on this bus: ${unknown.join(', ')}` };
  }

  const next: SeatFareMap = { ...current };
  for (const seat of target) {
    const rule: SeatFareRule = { ...(next[seat] ?? { multiplier: 1 }) };

    if (change.setMultiplier !== undefined) {
      rule.multiplier = change.setMultiplier;
    } else if (change.percent !== undefined) {
      rule.multiplier = Number(rule.multiplier) * (1 + change.percent / 100);
    }
    if (change.delta !== undefined) {
      rule.delta = Number(rule.delta ?? 0) + change.delta;
    }

    rule.multiplier = Math.round(Number(rule.multiplier) * 10000) / 10000;

    const check = isValidSeatFareRule(rule);
    if (!check.ok) {
      return {
        ok: false,
        code: check.code!,
        message: `Seat ${seat}: ${check.message}`,
      };
    }
    next[seat] = rule;
  }
  return { ok: true, map: next };
}
