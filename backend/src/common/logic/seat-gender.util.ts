/**
 * Gender-based seat validation logic (pure functions, fully unit-testable).
 *
 * Covers requirements 7, 8, 9, 10:
 *  - Ladies-reserved seats (operator-configurable) → female-only.
 *  - Adjacent/paired-seat rule → if the paired seat is held by a female,
 *    the seat may only be booked by a female.
 *  - Mixed-gender bookings allowed, as long as each seat assignment obeys the rules.
 */

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | string;

export interface SeatAssignment {
  seatNumber: string;
  gender: Gender;
}

export interface OccupiedSeat {
  seatNumber: string;
  gender: Gender;
}

export interface SeatValidationResult {
  ok: boolean;
  code?: string;
  message?: string;
  seatNumber?: string;
}

const isFemale = (g: Gender) => String(g).toUpperCase() === 'FEMALE';
const isMale = (g: Gender) => String(g).toUpperCase() === 'MALE';

/**
 * Validates a set of new seat assignments against ladies-reserved config and
 * the adjacency rule, considering seats already occupied on the same trip.
 *
 * @param assignments   new seats being booked, each with its passenger gender
 * @param ladiesReserved operator-configured female-only seat numbers
 * @param adjacency     paired-seat map (seat → its paired seat)
 * @param occupied      seats already booked on this trip (active), with genders
 */
export function validateSeatGenderAssignment(
  assignments: SeatAssignment[],
  ladiesReserved: string[],
  adjacency: Record<string, string>,
  occupied: OccupiedSeat[],
): SeatValidationResult {
  const reserved = new Set((ladiesReserved || []).map((s) => s.toUpperCase()));
  const occupiedMap = new Map<string, Gender>();
  for (const o of occupied) occupiedMap.set(o.seatNumber.toUpperCase(), o.gender);

  // Also treat the seats being booked together as "occupied" for adjacency checks
  // (so booking a female into L3 lets the same booking put a female in L4).
  const withinBooking = new Map<string, Gender>();
  for (const a of assignments) withinBooking.set(a.seatNumber.toUpperCase(), a.gender);

  for (const a of assignments) {
    const seat = a.seatNumber.toUpperCase();

    // Rule 8 — ladies-reserved seats are female-only.
    if (reserved.has(seat) && !isFemale(a.gender)) {
      return {
        ok: false,
        code: 'LADIES_RESERVED_SEAT',
        seatNumber: a.seatNumber,
        message: `Seat ${a.seatNumber} is reserved for female passengers only.`,
      };
    }

    // Rule 7 & 10 — adjacency/paired-seat rule.
    const pairedSeat = (adjacency || {})[seat] || (adjacency || {})[a.seatNumber];
    if (pairedSeat) {
      const pairKey = pairedSeat.toUpperCase();
      // Gender of the paired seat: already occupied on the trip, or booked together now.
      const pairedGender = occupiedMap.get(pairKey) ?? withinBooking.get(pairKey);
      if (pairedGender && isFemale(pairedGender) && isMale(a.gender)) {
        return {
          ok: false,
          code: 'ADJACENT_FEMALE_SEAT',
          seatNumber: a.seatNumber,
          message: `Only female passengers can book seat ${a.seatNumber} because the adjacent seat ${pairedSeat} is already occupied by a female passenger.`,
        };
      }
    }
  }

  return { ok: true };
}
