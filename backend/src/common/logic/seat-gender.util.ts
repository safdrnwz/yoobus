/**
 * Gender-based seat validation logic (pure functions, fully unit-testable).
 *
 * Implements the "Seat Layout & Gender-Based Seat Allocation" specification:
 *
 *  - Ladies-reserved / FEMALE_ONLY seats (operator-configurable) → female-only.
 *  - MALE_ONLY seats → male-only.
 *  - Female Adjacent Seat Protection: an unrelated male passenger from a
 *    DIFFERENT booking cannot take the seat paired with a female passenger
 *    (Scenario 1, 3, 8 → BLOCKED).
 *  - Same-booking exception: husband-wife / couple / family / friends in the
 *    SAME booking may sit together regardless of gender mix
 *    (Scenario 2, 7, 13, 14 → ALLOWED).
 *  - Linked/approved passenger group exception (Case 5 → ALLOWED).
 *  - Same-gender adjacency always allowed (Scenario 4, 5 → ALLOWED).
 *  - Direction of protection is operator-configurable (spec §22):
 *    Option A (female protection only) or Option B (both directions —
 *    Case 4: a female from a different booking is also blocked next to a male).
 *
 * Everything is driven by an operator-level GenderRuleConfig (spec §15/§23/§24)
 * with platform defaults matching the spec's recommended configuration.
 */

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'NOT_SPECIFIED' | string;

export interface SeatAssignment {
  seatNumber: string;
  gender: Gender;
}

export interface OccupiedSeat {
  seatNumber: string;
  gender: Gender;
  /** Booking the occupant belongs to. Absent on legacy rows → treated as a different booking. */
  bookingId?: string | null;
  /** Approved linked passenger group, if any. */
  passengerGroupId?: string | null;
}

export interface SeatValidationResult {
  ok: boolean;
  code?: string;
  message?: string;
  seatNumber?: string;
}

/** Operator-configurable gender rules (spec §15 / §23 GenderRuleConfiguration). */
export interface GenderRuleConfig {
  /** Master switch for the adjacent-seat rule. */
  femaleAdjacentProtection: 'ENABLED' | 'DISABLED';
  /** Male next to a female from a DIFFERENT booking. */
  differentBookingMaleFemale: 'BLOCK' | 'ALLOW';
  /** Male + female inside the SAME booking (couple/family). */
  sameBookingMaleFemale: 'ALLOW' | 'BLOCK';
  /** Spec §22 Option B — also block a female taking the seat next to an unrelated male. */
  bothDirectionProtection: boolean;
  /** Honour approved linked passenger groups across bookings (Case 5). */
  familyGroupException: 'ENABLED' | 'DISABLED';
}

/** Platform default = spec §24 "RECOMMENDED CONFIGURATION". */
export const DEFAULT_GENDER_RULES: GenderRuleConfig = {
  femaleAdjacentProtection: 'ENABLED',
  differentBookingMaleFemale: 'BLOCK',
  sameBookingMaleFemale: 'ALLOW',
  bothDirectionProtection: false,
  familyGroupException: 'ENABLED',
};

/** Merge a partial operator config over the platform defaults. */
export function resolveGenderRules(partial?: Partial<GenderRuleConfig> | null): GenderRuleConfig {
  return { ...DEFAULT_GENDER_RULES, ...(partial ?? {}) };
}

export interface GenderValidationOptions {
  /** Operator's configured rules; defaults to the platform recommendation. */
  config?: Partial<GenderRuleConfig> | null;
  /** Seats only male passengers may book (MALE_ONLY seat gender rule). */
  maleOnlySeats?: string[];
  /** The approved passenger-group the NEW booking belongs to, if any. */
  passengerGroupId?: string | null;
  /** Booking ids whose passengers are "linked" to this booking (approved group / linked PNR). */
  linkedBookingIds?: string[];
}

const isFemale = (g: Gender) => String(g).toUpperCase() === 'FEMALE';
const isMale = (g: Gender) => String(g).toUpperCase() === 'MALE';

/**
 * Validates a set of new seat assignments against seat gender rules, the
 * paired-seat adjacency rule, and the operator's gender configuration —
 * considering seats already occupied on the same trip.
 *
 * Called at every validation point (spec §19): seat lock, booking confirmation,
 * counter/agent/OTA booking, seat change and reaccommodation. Server-side only;
 * the rule never relies on the frontend.
 *
 * @param assignments    new seats being booked (all part of ONE booking), with genders
 * @param ladiesReserved operator/layout-configured female-only seat numbers
 * @param adjacency      paired-seat map (seat → its paired seat)
 * @param occupied       seats already booked on this trip (active), with genders
 * @param options        operator config, MALE_ONLY seats, linked-group info
 */
export function validateSeatGenderAssignment(
  assignments: SeatAssignment[],
  ladiesReserved: string[],
  adjacency: Record<string, string>,
  occupied: OccupiedSeat[],
  options?: GenderValidationOptions,
): SeatValidationResult {
  const cfg = resolveGenderRules(options?.config);
  const reserved = new Set((ladiesReserved || []).map((s) => s.toUpperCase()));
  const maleOnly = new Set((options?.maleOnlySeats || []).map((s) => s.toUpperCase()));
  const linkedBookings = new Set((options?.linkedBookingIds || []).filter(Boolean));
  const newGroupId = options?.passengerGroupId ?? null;

  const occupiedMap = new Map<string, OccupiedSeat>();
  for (const o of occupied) occupiedMap.set(o.seatNumber.toUpperCase(), o);

  // Seats being booked together count as "same booking" for the adjacency rule
  // (spec Scenario 2/7 — couple selecting L3+L4 in one booking).
  const withinBooking = new Map<string, Gender>();
  for (const a of assignments) withinBooking.set(a.seatNumber.toUpperCase(), a.gender);

  /** Is this already-occupied seat related to the new booking (approved group / linked PNR)? */
  const isLinked = (occ: OccupiedSeat): boolean => {
    if (cfg.familyGroupException !== 'ENABLED') return false;
    if (occ.bookingId && linkedBookings.has(occ.bookingId)) return true;
    if (newGroupId && occ.passengerGroupId && occ.passengerGroupId === newGroupId) return true;
    return false;
  };

  for (const a of assignments) {
    const seat = a.seatNumber.toUpperCase();

    // Seat gender rule — FEMALE (ladies-reserved) seats are female-only.
    if (reserved.has(seat) && !isFemale(a.gender)) {
      return {
        ok: false,
        code: 'LADIES_RESERVED_SEAT',
        seatNumber: a.seatNumber,
        message: `Seat ${a.seatNumber} is reserved for female passengers only.`,
      };
    }

    // Seat gender rule — MALE seats are male-only.
    if (maleOnly.has(seat) && !isMale(a.gender)) {
      return {
        ok: false,
        code: 'MALE_ONLY_SEAT',
        seatNumber: a.seatNumber,
        message: `Seat ${a.seatNumber} is reserved for male passengers only.`,
      };
    }

    // Adjacent/paired-seat protection (spec §4–§12).
    if (cfg.femaleAdjacentProtection !== 'ENABLED') continue;

    const pairedSeat = (adjacency || {})[seat] || (adjacency || {})[a.seatNumber];
    if (!pairedSeat) continue;
    const pairKey = pairedSeat.toUpperCase();

    // 1) Pair inside the SAME booking → same-booking exception (Scenario 2/7).
    const pairedWithin = withinBooking.get(pairKey);
    if (pairedWithin !== undefined) {
      const mixed =
        (isFemale(pairedWithin) && isMale(a.gender)) || (isMale(pairedWithin) && isFemale(a.gender));
      if (mixed && cfg.sameBookingMaleFemale === 'BLOCK') {
        return {
          ok: false,
          code: 'SAME_BOOKING_MIXED_GENDER_BLOCKED',
          seatNumber: a.seatNumber,
          message: `This operator does not allow mixed-gender passengers on paired seats ${pairedSeat}/${a.seatNumber}, even within the same booking.`,
        };
      }
      continue; // same booking → allowed (default), nothing else to check for this pair
    }

    // 2) Pair occupied by a DIFFERENT booking.
    const occ = occupiedMap.get(pairKey);
    if (!occ) continue; // paired seat empty (Scenario 6 handled when the other side books)
    if (isLinked(occ)) continue; // approved group / linked booking (Case 5) → allowed

    // Scenario 1/3/8 — unrelated male next to a booked female → BLOCK.
    if (isFemale(occ.gender) && isMale(a.gender) && cfg.differentBookingMaleFemale === 'BLOCK') {
      return {
        ok: false,
        code: 'ADJACENT_FEMALE_SEAT',
        seatNumber: a.seatNumber,
        message: `Only female passengers can book seat ${a.seatNumber} because the adjacent seat ${pairedSeat} is already occupied by a female passenger from another booking.`,
      };
    }

    // Case 4 / spec §22 Option B — female next to an unrelated male, both directions.
    if (
      cfg.bothDirectionProtection &&
      isMale(occ.gender) &&
      isFemale(a.gender) &&
      cfg.differentBookingMaleFemale === 'BLOCK'
    ) {
      return {
        ok: false,
        code: 'ADJACENT_MALE_SEAT',
        seatNumber: a.seatNumber,
        message: `Seat ${a.seatNumber} cannot be booked by a female passenger because the adjacent seat ${pairedSeat} is occupied by a male passenger from another booking.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Female Preferred Seat optimisation (spec §18). Ranks candidate seats for a
 * female passenger — a preference layer only, never overriding hard rules.
 * Lower score = better.
 */
export function rankSeatsForFemale(
  candidates: string[],
  adjacency: Record<string, string>,
  ladiesReserved: string[],
  occupied: OccupiedSeat[],
): string[] {
  const reserved = new Set((ladiesReserved || []).map((s) => s.toUpperCase()));
  const occMap = new Map<string, OccupiedSeat>();
  for (const o of occupied) occMap.set(o.seatNumber.toUpperCase(), o);

  const score = (seatRaw: string): number => {
    const seat = seatRaw.toUpperCase();
    const pair = ((adjacency || {})[seat] || '').toUpperCase();
    const neighbour = pair ? occMap.get(pair) : undefined;
    if (neighbour && isFemale(neighbour.gender)) return 0; // 1. female next to female
    if (pair && !neighbour) return 1; // 2. female next to empty seat
    if (reserved.has(seat)) return 2; // 3. protected seat
    return 3; // 4. anything else allowed
  };

  return [...candidates].sort((x, y) => score(x) - score(y));
}
