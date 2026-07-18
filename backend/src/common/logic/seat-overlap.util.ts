// Pure, dependency-free logic — fully unit-testable.
// Multi-stop seat inventory: a seat can be sold again on separate, non-overlapping legs.

export interface SeatSegment {
  seatNumber: string;
  boardingOrder: number;
  droppingOrder: number;
}

// Do segment overlap karte hain iff a.board < b.drop && b.board < a.drop
export function segmentsOverlap(
  aBoard: number,
  aDrop: number,
  bBoard: number,
  bDrop: number,
): boolean {
  return aBoard < bDrop && bBoard < aDrop;
}

// Occupied seat numbers for the requested segment [reqBoard, reqDrop).
export function occupiedSeats(
  existing: SeatSegment[],
  reqBoard: number,
  reqDrop: number,
): Set<string> {
  const taken = new Set<string>();
  for (const s of existing) {
    if (segmentsOverlap(s.boardingOrder, s.droppingOrder, reqBoard, reqDrop)) {
      taken.add(s.seatNumber);
    }
  }
  return taken;
}

// Konsi requested seats already booked hain (conflict)
export function conflictingSeats(
  existing: SeatSegment[],
  requested: string[],
  reqBoard: number,
  reqDrop: number,
): string[] {
  const taken = occupiedSeats(existing, reqBoard, reqDrop);
  return requested.filter((s) => taken.has(s));
}
