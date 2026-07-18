import {
  autoNumber,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  deriveBusSeating,
  GRID,
  isBookable,
  mirrorItems,
  snap,
  validateLayout,
  type LayoutDefinition,
  type LayoutItem,
} from '../src/common/logic/seat-layout.util';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? ` — got ${JSON.stringify(got)}` : ''}`);
  }
};

let seq = 0;
const id = () => `i${seq++}`;

const seat = (x: number, y: number, n: string, props?: LayoutItem['props']): LayoutItem => ({
  id: id(),
  kind: 'SEATER',
  x,
  y,
  w: 40,
  h: 40,
  rotation: 0,
  seatNumber: n,
  props,
});

const fixture = (x: number, y: number, kind: LayoutItem['kind'], w = 40, h = 40): LayoutItem => ({
  id: id(),
  kind,
  x,
  y,
  w,
  h,
  rotation: 0,
});

/** A legal 2x2 coach: driver, door, four rows of four. */
function goodLayout(): LayoutDefinition {
  const items: LayoutItem[] = [fixture(0, 0, 'DRIVER'), fixture(260, 0, 'ENTRANCE')];
  let n = 1;
  for (let row = 0; row < 4; row++) {
    const y = 80 + row * 60;
    items.push(seat(20, y, String(n++)));
    items.push(seat(60, y, String(n++)));
    items.push(seat(200, y, String(n++)));
    items.push(seat(240, y, String(n++)));
  }
  return { decks: [{ deck: 'LOWER', items }] };
}

console.log('\n── The canvas ───────────────────────────────────────');
check('the canvas is the 320x800 the spec fixes it at', CANVAS_WIDTH === 320 && CANVAS_HEIGHT === 800);
check('everything snaps to the grid', snap(27) === GRID && snap(31) === 40, [snap(27), snap(31)]);
check('a seater is bookable, a driver seat is not', isBookable('SEATER') && !isBookable('DRIVER'));

console.log('\n── A layout that should pass ────────────────────────');
const good = goodLayout();
check('a well-formed 2x2 coach validates clean', validateLayout(good).length === 0, validateLayout(good));

console.log('\n── Everything the validator must catch ──────────────');

const dup = goodLayout();
dup.decks[0].items[5].seatNumber = dup.decks[0].items[4].seatNumber;
check(
  'a duplicate seat number is caught — it is a double-booked passenger',
  validateLayout(dup).some((e) => e.code === 'DUPLICATE_SEAT_NUMBER'),
);

const unnumbered = goodLayout();
delete unnumbered.decks[0].items[3].seatNumber;
check(
  'a seat with no number is caught',
  validateLayout(unnumbered).some((e) => e.code === 'SEAT_UNNUMBERED'),
);

const outside = goodLayout();
outside.decks[0].items[2].x = 300; // 300 + 40 = 340 > 320
check(
  'a seat hanging off the side of the bus is caught',
  validateLayout(outside).some((e) => e.code === 'ITEM_OUTSIDE_CANVAS'),
);

const offGrid = goodLayout();
offGrid.decks[0].items[2].x = 33;
check(
  'a seat off the grid is caught',
  validateLayout(offGrid).some((e) => e.code === 'ITEM_OFF_GRID'),
);

const overlap = goodLayout();
overlap.decks[0].items[3].x = overlap.decks[0].items[2].x;
overlap.decks[0].items[3].y = overlap.decks[0].items[2].y;
check(
  'two seats on top of each other are caught',
  validateLayout(overlap).some((e) => e.code === 'ITEMS_OVERLAP'),
);

const spun = goodLayout();
(spun.decks[0].items[2] as { rotation: number }).rotation = 45;
check(
  'a 45° rotation is caught — we can only draw four angles',
  validateLayout(spun).some((e) => e.code === 'INVALID_ROTATION'),
);

const noDriver: LayoutDefinition = {
  decks: [{ deck: 'LOWER', items: [fixture(260, 0, 'ENTRANCE'), seat(20, 80, '1')] }],
};
check('a bus with no driver is caught', validateLayout(noDriver).some((e) => e.code === 'NO_DRIVER'));

const noDoor: LayoutDefinition = {
  decks: [{ deck: 'LOWER', items: [fixture(0, 0, 'DRIVER'), seat(20, 80, '1')] }],
};
check('a bus with no entrance is caught', validateLayout(noDoor).some((e) => e.code === 'NO_ENTRANCE'));

const noSeats: LayoutDefinition = {
  decks: [{ deck: 'LOWER', items: [fixture(0, 0, 'DRIVER'), fixture(260, 0, 'ENTRANCE')] }],
};
check('a bus with no seats is caught', validateLayout(noSeats).some((e) => e.code === 'NO_SEATS'));

const contradiction = goodLayout();
contradiction.decks[0].items[2].props = { reserved: true, blocked: true };
check(
  'a seat that is both reserved and blocked is a contradiction, and is caught',
  validateLayout(contradiction).some((e) => e.code === 'RESERVED_AND_BLOCKED'),
);

console.log('\n── Two decks ────────────────────────────────────────');

const twoDecks: LayoutDefinition = {
  decks: [
    { deck: 'LOWER', items: [fixture(0, 0, 'DRIVER'), fixture(260, 0, 'ENTRANCE'), seat(20, 80, 'L1')] },
    { deck: 'UPPER', items: [seat(20, 80, 'U1'), seat(60, 80, 'U2')] },
  ],
};
check(
  'an upper deck with no stair is caught — nobody can reach it',
  validateLayout(twoDecks).some((e) => e.code === 'NO_STAIR'),
);

twoDecks.decks[0].items.push(fixture(140, 0, 'STAIR', 40, 60));
check('with a stair, the double-decker validates', validateLayout(twoDecks).length === 0, validateLayout(twoDecks));

// Seat numbers are unique across the WHOLE bus, not per deck: a ticket says "1A" and that
// must mean exactly one bed.
const clash: LayoutDefinition = {
  decks: [
    {
      deck: 'LOWER',
      items: [fixture(0, 0, 'DRIVER'), fixture(260, 0, 'ENTRANCE'), fixture(140, 0, 'STAIR', 40, 60), seat(20, 80, 'A1')],
    },
    { deck: 'UPPER', items: [seat(20, 80, 'A1')] },
  ],
};
check(
  'the same seat number on two DIFFERENT decks is still a duplicate',
  validateLayout(clash).some((e) => e.code === 'DUPLICATE_SEAT_NUMBER'),
);

console.log('\n── Derivation — what the booking engine actually reads ──');

const derived = deriveBusSeating(good);
check('every seat lands in the flat seat map', derived.seatMap.length === 16, derived.seatMap.length);
check('the seat count matches', derived.totalSeats === 16);
check('seats come out in reading order — down the bus, then across', derived.seatMap[0] === '1' && derived.seatMap[1] === '2', derived.seatMap.slice(0, 4));

// Adjacency is what stops a lone woman being seated beside a male stranger. It used to be
// typed in by hand, pair by pair. The drawing knows.
check('seats 1 and 2 sit side by side, and the drawing worked that out', derived.seatAdjacency['1'] === '2', derived.seatAdjacency);
check('seat 2 is NOT paired across the aisle with seat 3', derived.seatAdjacency['2'] !== '3', derived.seatAdjacency['2']);

const withLadies = goodLayout();
withLadies.decks[0].items[2].props = { gender: 'FEMALE_ONLY' };
withLadies.decks[0].items[3].props = { fareZone: 'LADIES' };
const dl = deriveBusSeating(withLadies);
check('a FEMALE_ONLY seat becomes a ladies-reserved seat', dl.ladiesReservedSeats.includes('1'), dl.ladiesReservedSeats);
check('so does a seat in the LADIES fare zone', dl.ladiesReservedSeats.includes('2'), dl.ladiesReservedSeats);

const withBlocked = goodLayout();
withBlocked.decks[0].items[2].props = { blocked: true };
withBlocked.decks[0].items[4].props = { reserved: true };
const db = deriveBusSeating(withBlocked);
check('a blocked seat is not sellable', !db.seatMap.includes('1'), db.seatMap.slice(0, 4));
check('a reserved seat is not sellable either', !db.seatMap.includes('3'), db.seatMap.slice(0, 4));
check('the seat count drops accordingly', db.totalSeats === 14, db.totalSeats);

const zoned = goodLayout();
zoned.decks[0].items[2].props = { fareZone: 'PREMIUM' };
const dz = deriveBusSeating(zoned);
check('a seat carries its fare ZONE, never a price', dz.seatZones['1'] === 'PREMIUM' && dz.seatZones['2'] === 'STANDARD', dz.seatZones);

console.log('\n── Builder helpers ──────────────────────────────────');

const unnumberedRows: LayoutItem[] = [
  fixture(0, 0, 'DRIVER'),
  { ...seat(60, 100, ''), seatNumber: undefined },
  { ...seat(20, 100, ''), seatNumber: undefined },
  { ...seat(20, 40, ''), seatNumber: undefined },
];
const numbered = autoNumber(unnumberedRows, 'L');
const nums = numbered.filter((i) => isBookable(i.kind)).map((i) => i.seatNumber);
check('auto-numbering runs in reading order, with a prefix', nums.includes('L1') && nums.includes('L3'), nums);
check('auto-numbering never numbers the driver', numbered.find((i) => i.kind === 'DRIVER')?.seatNumber === undefined);

const left = [seat(20, 100, 'A1'), seat(60, 100, 'A2')];
const mirrored = mirrorItems(left, (i) => `m${i}`);
check('mirroring flips across the centre line', mirrored[0].x === CANVAS_WIDTH - 20 - 40, mirrored[0].x);
check(
  'mirrored seats come back UNNUMBERED — a silent duplicate would be worse than an error',
  mirrored.every((m) => m.seatNumber === undefined),
);

console.log(`\n${'='.repeat(56)}\n  PASSED: ${pass}   FAILED: ${fail}\n${'='.repeat(56)}\n`);
process.exit(fail ? 1 : 0);
