/**
 * OTA/GDS distribution (Phase 3). A single inventory is shared across sales channels
 * (DIRECT, plus OTAs). When a seat is sold on any channel it must be sold on all of
 * them, preventing cross-channel double-booking. This pure helper decides whether a
 * channel booking request is allowed against the central inventory.
 */
export interface ChannelInventory {
  tripId: string;
  soldSeats: string[]; // seats already sold across ALL channels
}

export function isSeatSellableOnChannel(inventory: ChannelInventory, requestedSeats: string[]): {
  ok: boolean;
  clashing: string[];
} {
  const sold = new Set(inventory.soldSeats);
  const clashing = requestedSeats.filter((s) => sold.has(s));
  return { ok: clashing.length === 0, clashing };
}

// After a confirmed sale on one channel, broadcast the seats to mark them sold everywhere.
export function applySale(inventory: ChannelInventory, seats: string[]): ChannelInventory {
  const merged = new Set([...inventory.soldSeats, ...seats]);
  return { tripId: inventory.tripId, soldSeats: [...merged] };
}
