/**
 * Seat layout — the domain.
 *
 * An operator draws the inside of a bus once, saves it as a template, and points as many
 * buses at it as they like. Until now a bus carried a flat `seatMap: string[]` and nothing
 * else: no idea where a seat physically sits, so no seat map worth looking at, no window
 * seats, no sleeper berths, no upper deck.
 *
 * FOUR LAYERS, and keeping them apart is the whole point (§20 of the spec):
 *
 *     Template  →  Bus  →  Trip snapshot  →  Booking
 *
 *   Template   the drawing. Versioned. Once published it is never edited again.
 *   Bus        points at ONE published version.
 *   Trip       takes a COPY of that version the moment it is created.
 *   Booking    only ever touches the trip's copy.
 *
 * That last hop is not ceremony. Without it, republishing a layout — renumbering a row,
 * removing a seat — would silently change the meaning of tickets already sold: a passenger
 * holding seat "1A" could find that seat no longer exists. The copy makes the past immutable.
 *
 * This file is pure. No database, no HTTP. Everything here can be tested in a millisecond,
 * and everything here IS tested.
 */

/* ─────────────────────────── The canvas ─────────────────────────── */

/** The bus interior, drawn to a fixed vertical canvas so every layout renders alike. */
export const CANVAS_WIDTH = 320;
export const CANVAS_HEIGHT = 800;

/** Everything snaps to this. It is what stops a layout looking hand-drawn. */
export const GRID = 20;

export function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

/* ─────────────────────────── What can be placed ─────────────────────────── */

export type DeckId = 'LOWER' | 'UPPER';

/**
 * Every kind of thing that can sit on the canvas.
 *
 * Adding a kind here — a washroom, a charging point — needs no change anywhere else: the
 * builder renders whatever the catalogue lists, and the validator only cares whether an item
 * is bookable. That is the "no code changes for a new bus type" promise, made good.
 */
export type ItemKind =
  // bookable
  | 'SEATER'
  | 'SLEEPER_V'
  | 'SLEEPER_H'
  | 'SEMI_SLEEPER'
  // occupied by staff — a real seat, never sold
  | 'DRIVER'
  | 'CREW'
  // furniture
  | 'ENTRANCE'
  | 'EXIT'
  | 'STAIR'
  | 'TOILET'
  | 'WHEEL_ARCH'
  | 'PARTITION'
  | 'EMPTY';

/** The kinds a passenger can actually buy. Everything else is scenery or staff. */
export const BOOKABLE_KINDS: ItemKind[] = ['SEATER', 'SLEEPER_V', 'SLEEPER_H', 'SEMI_SLEEPER'];

export function isBookable(kind: ItemKind): boolean {
  return BOOKABLE_KINDS.includes(kind);
}

/** The default footprint of each kind, in pixels. A sleeper is a bed; a seater is a chair. */
export const ITEM_SIZE: Record<ItemKind, { w: number; h: number }> = {
  SEATER: { w: 40, h: 40 },
  SEMI_SLEEPER: { w: 40, h: 60 },
  SLEEPER_V: { w: 40, h: 80 },
  SLEEPER_H: { w: 80, h: 40 },
  DRIVER: { w: 40, h: 40 },
  CREW: { w: 40, h: 40 },
  ENTRANCE: { w: 40, h: 40 },
  EXIT: { w: 40, h: 40 },
  STAIR: { w: 40, h: 60 },
  TOILET: { w: 60, h: 60 },
  WHEEL_ARCH: { w: 40, h: 60 },
  PARTITION: { w: 20, h: 60 },
  EMPTY: { w: 40, h: 40 },
};

export type Rotation = 0 | 90 | 180 | 270;
export const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** Who may sit here. Enforced at booking time by the existing gender rules. */
export type GenderRule = 'ANY' | 'FEMALE_ONLY' | 'MALE_ONLY';

/**
 * A fare zone, not a price.
 *
 * The builder never stores rupees. A seat says "I am a PREMIUM seat"; what a PREMIUM seat
 * costs today is the pricing engine's business, and it depends on how far the passenger is
 * travelling. Bake a price into the drawing and it is wrong the first time someone books a
 * shorter leg.
 */
export type FareZone = 'PREMIUM' | 'STANDARD' | 'ECONOMY' | 'LAST_ROW' | 'LADIES' | 'LUXURY';

export interface SeatProps {
  gender?: GenderRule;
  fareZone?: FareZone;
  isWindow?: boolean;
  isAisle?: boolean;
  /** Held back for staff or VIPs — drawn, never sold. */
  reserved?: boolean;
  /** Out of service — hidden from booking entirely. */
  blocked?: boolean;
  wheelchair?: boolean;
  label?: string;
  notes?: string;
}

export interface LayoutItem {
  /** Stable within the layout. The builder's undo history depends on it. */
  id: string;
  kind: ItemKind;
  /** Top-left, in canvas pixels, snapped to the grid. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: Rotation;
  /** Bookable items only. Unique across the WHOLE layout, both decks. */
  seatNumber?: string;
  props?: SeatProps;
}

export interface Deck {
  deck: DeckId;
  items: LayoutItem[];
}

export interface LayoutDefinition {
  decks: Deck[];
}

/* ─────────────────────────── Validation ─────────────────────────── */

export interface LayoutError {
  code: string;
  message: string;
  /** Which item is at fault, when it is one item's fault. */
  itemId?: string;
  deck?: DeckId;
}

/** Two rectangles overlap when they overlap on BOTH axes. Touching edges do not count. */
function overlaps(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Everything that must be true before a layout may be published.
 *
 * Publishing is the point of no return — buses will point at this version and trips will copy
 * it — so this is the last moment anything can be caught. A draft may be as broken as the
 * operator likes while they are still drawing.
 */
export function validateLayout(def: LayoutDefinition): LayoutError[] {
  const errors: LayoutError[] = [];
  const decks = def?.decks ?? [];

  if (!decks.length) {
    return [{ code: 'NO_DECK', message: 'A layout needs at least one deck.' }];
  }

  const seenDecks = new Set<DeckId>();
  for (const deck of decks) {
    if (seenDecks.has(deck.deck)) {
      errors.push({ code: 'DUPLICATE_DECK', message: `Deck ${deck.deck} appears twice.`, deck: deck.deck });
    }
    seenDecks.add(deck.deck);
  }

  const allItems = decks.flatMap((d) => d.items.map((i) => ({ ...i, _deck: d.deck })));

  // ---- Seat numbers are unique across the WHOLE bus, not per deck. A ticket says "1A";
  //      it must mean exactly one bed on exactly one deck.
  const byNumber = new Map<string, string[]>();
  for (const item of allItems) {
    if (!isBookable(item.kind)) continue;

    const n = (item.seatNumber ?? '').trim();
    if (!n) {
      errors.push({
        code: 'SEAT_UNNUMBERED',
        message: 'Every bookable seat needs a number.',
        itemId: item.id,
        deck: item._deck,
      });
      continue;
    }
    byNumber.set(n.toUpperCase(), [...(byNumber.get(n.toUpperCase()) ?? []), item.id]);
  }
  for (const [number, ids] of byNumber) {
    if (ids.length > 1) {
      errors.push({
        code: 'DUPLICATE_SEAT_NUMBER',
        message: `Seat number ${number} is used ${ids.length} times.`,
        itemId: ids[1],
      });
    }
  }

  for (const deck of decks) {
    for (const item of deck.items) {
      // ---- inside the canvas
      if (item.x < 0 || item.y < 0 || item.x + item.w > CANVAS_WIDTH || item.y + item.h > CANVAS_HEIGHT) {
        errors.push({
          code: 'ITEM_OUTSIDE_CANVAS',
          message: `${item.seatNumber ?? item.kind} falls outside the bus.`,
          itemId: item.id,
          deck: deck.deck,
        });
      }

      // ---- on the grid
      if (item.x % GRID !== 0 || item.y % GRID !== 0) {
        errors.push({
          code: 'ITEM_OFF_GRID',
          message: `${item.seatNumber ?? item.kind} is not aligned to the grid.`,
          itemId: item.id,
          deck: deck.deck,
        });
      }

      // ---- a rotation we can actually render
      if (!ROTATIONS.includes(item.rotation)) {
        errors.push({
          code: 'INVALID_ROTATION',
          message: `${item.rotation}° is not a rotation we can draw. Use 0, 90, 180 or 270.`,
          itemId: item.id,
          deck: deck.deck,
        });
      }

      // ---- a seat that is both held back and out of service is a contradiction
      if (item.props?.reserved && item.props?.blocked) {
        errors.push({
          code: 'RESERVED_AND_BLOCKED',
          message: `${item.seatNumber ?? item.kind} cannot be both reserved and blocked.`,
          itemId: item.id,
          deck: deck.deck,
        });
      }
    }

    // ---- nothing sits on top of anything else
    for (let i = 0; i < deck.items.length; i++) {
      for (let j = i + 1; j < deck.items.length; j++) {
        if (overlaps(deck.items[i], deck.items[j])) {
          errors.push({
            code: 'ITEMS_OVERLAP',
            message: `${deck.items[i].seatNumber ?? deck.items[i].kind} overlaps ${
              deck.items[j].seatNumber ?? deck.items[j].kind
            }.`,
            itemId: deck.items[j].id,
            deck: deck.deck,
          });
        }
      }
    }
  }

  // ---- The lower deck is the one with the road under it. It needs a driver and a way in.
  const lower = decks.find((d) => d.deck === 'LOWER');
  if (!lower) {
    errors.push({ code: 'NO_LOWER_DECK', message: 'Every bus has a lower deck.' });
  } else {
    if (!lower.items.some((i) => i.kind === 'DRIVER')) {
      errors.push({ code: 'NO_DRIVER', message: 'The lower deck has no driver seat.', deck: 'LOWER' });
    }
    if (!lower.items.some((i) => i.kind === 'ENTRANCE')) {
      errors.push({ code: 'NO_ENTRANCE', message: 'The lower deck has no entrance door.', deck: 'LOWER' });
    }
  }

  // ---- An upper deck nobody can reach is a drawing error, not a design.
  const upper = decks.find((d) => d.deck === 'UPPER');
  if (upper && upper.items.length > 0) {
    const hasStair = decks.some((d) => d.items.some((i) => i.kind === 'STAIR'));
    if (!hasStair) {
      errors.push({
        code: 'NO_STAIR',
        message: 'There is an upper deck but no stair to reach it.',
        deck: 'UPPER',
      });
    }
  }

  // ---- A bus with no seats is not a bus.
  if (!allItems.some((i) => isBookable(i.kind))) {
    errors.push({ code: 'NO_SEATS', message: 'This layout has no bookable seats.' });
  }

  return errors;
}

/* ─────────────────────────── Derivation ─────────────────────────── */

/**
 * The flat shape the booking engine already speaks.
 *
 * This is the load-bearing function of the whole feature. The booking engine, the OTA API,
 * the trip seat map and the gender rules were all written against `bus.seatMap: string[]`,
 * `ladiesReservedSeats`, `seatAdjacency`. Rather than rewrite six modules and risk the money
 * path, the layout DERIVES exactly those fields. Assign a template to a bus and the bus's old
 * shape is regenerated from the drawing — every existing test keeps passing, and nothing in
 * the booking chain has to know a builder exists.
 */
export interface DerivedBusSeating {
  seatMap: string[];
  totalSeats: number;
  ladiesReservedSeats: string[];
  seatAdjacency: Record<string, string>;
  /** Zone per seat, so the pricing engine can price a zone rather than 40 individual seats. */
  seatZones: Record<string, FareZone>;
}

/** Reading order: down the bus, then across it. It is how people number a coach. */
function readingOrder(a: LayoutItem, b: LayoutItem): number {
  return a.y - b.y || a.x - b.x;
}

/**
 * Which seats physically sit next to each other.
 *
 * Adjacency is not decoration: it is what stops a lone woman being allocated the seat beside
 * a male stranger. It used to be typed in by hand, pair by pair. Now the drawing knows — two
 * items on the same row, with nothing between them, ARE neighbours.
 */
function deriveAdjacency(items: LayoutItem[]): Record<string, string> {
  const out: Record<string, string> = {};
  const seats = items.filter((i) => isBookable(i.kind) && i.seatNumber);

  for (const a of seats) {
    let best: { seat: LayoutItem; gap: number } | null = null;

    for (const b of seats) {
      if (a.id === b.id) continue;
      // Same row: their vertical spans overlap.
      const sameRow = a.y < b.y + b.h && b.y < a.y + a.h;
      if (!sameRow) continue;

      // Immediately beside, on either side, within one grid cell.
      const gap = b.x > a.x ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
      if (gap < 0 || gap > GRID) continue;

      // A partition or an aisle between them means they are NOT neighbours, whatever the
      // pixels say — which is the entire reason a partition is a placeable thing.
      const blocked = items.some(
        (m) =>
          (m.kind === 'PARTITION' || m.kind === 'STAIR' || m.kind === 'TOILET') &&
          m.y < Math.max(a.y + a.h, b.y + b.h) &&
          Math.min(a.y, b.y) < m.y + m.h &&
          m.x >= Math.min(a.x + a.w, b.x + b.w) &&
          m.x + m.w <= Math.max(a.x, b.x),
      );
      if (blocked) continue;

      if (!best || gap < best.gap) best = { seat: b, gap };
    }

    if (best) out[a.seatNumber!.toUpperCase()] = best.seat.seatNumber!.toUpperCase();
  }
  return out;
}

export function deriveBusSeating(def: LayoutDefinition): DerivedBusSeating {
  const decks = def?.decks ?? [];

  const bookable = decks
    .flatMap((d) => d.items)
    .filter((i) => isBookable(i.kind) && i.seatNumber && !i.props?.blocked && !i.props?.reserved)
    .sort(readingOrder);

  const seatMap = bookable.map((i) => i.seatNumber!.toUpperCase());

  const ladiesReservedSeats = bookable
    .filter((i) => i.props?.gender === 'FEMALE_ONLY' || i.props?.fareZone === 'LADIES')
    .map((i) => i.seatNumber!.toUpperCase());

  const seatZones: Record<string, FareZone> = {};
  for (const i of bookable) seatZones[i.seatNumber!.toUpperCase()] = i.props?.fareZone ?? 'STANDARD';

  // Adjacency is computed per deck: a seat on the lower deck is not next to one above it.
  const seatAdjacency: Record<string, string> = {};
  for (const deck of decks) Object.assign(seatAdjacency, deriveAdjacency(deck.items));

  return {
    seatMap,
    totalSeats: seatMap.length,
    ladiesReservedSeats,
    seatAdjacency,
    seatZones,
  };
}

/* ─────────────────────────── Helpers the builder needs ─────────────────────────── */

/**
 * Number every seat automatically, in reading order.
 *
 * Numbering 40 seats by hand is where mistakes come from, and a duplicate seat number is a
 * double-booked passenger. `prefix` lets a deck be "U1, U2…" while the other is "L1, L2…".
 */
export function autoNumber(items: LayoutItem[], prefix = '', start = 1): LayoutItem[] {
  let n = start;
  const ordered = [...items].sort(readingOrder);
  const numbered = new Map<string, string>();
  for (const item of ordered) {
    if (!isBookable(item.kind)) continue;
    numbered.set(item.id, `${prefix}${n++}`);
  }
  return items.map((i) => (numbered.has(i.id) ? { ...i, seatNumber: numbered.get(i.id) } : i));
}

/**
 * Mirror a selection across the vertical centre line.
 *
 * A bus is symmetrical. Drawing the left-hand column and mirroring it is how you build a
 * 2x2 coach in ten seconds instead of two minutes, forty times a year.
 */
export function mirrorItems(items: LayoutItem[], newId: (i: number) => string): LayoutItem[] {
  return items.map((item, index) => ({
    ...item,
    id: newId(index),
    x: snap(CANVAS_WIDTH - item.x - item.w),
    // The mirrored seat must be renumbered — a duplicate number would fail validation, which
    // is exactly what we want it to do rather than silently produce two seat 1As.
    seatNumber: undefined,
  }));
}
