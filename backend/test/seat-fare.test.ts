import { seatFare, seatFares, adjustSeatFares, type SeatFareMap } from '../src/common/logic/fare.util';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? ` — got ${JSON.stringify(got)}` : ''}`); }
};

console.log('\n── Per-seat fare ────────────────────────────────────');

const SEATS = ['1A', '1B', '2A', '2B', '3A', '3B'];
const BASE = 1000;

check('a seat with no rule costs the base fare', seatFare(BASE, 1, undefined) === 1000);
check('trip multiplier applies', seatFare(BASE, 1.2, undefined) === 1200);
check('a premium seat costs more', seatFare(BASE, 1, { multiplier: 1.15 }) === 1150);
check('a saver seat costs less', seatFare(BASE, 1, { multiplier: 0.9 }) === 900);
check('a flat premium stacks on the multiplier', seatFare(BASE, 1, { multiplier: 1.1, delta: 50 }) === 1150);
check('trip AND seat multipliers compose', seatFare(BASE, 1.2, { multiplier: 1.15 }) === 1380);
check('fare never goes below zero', seatFare(BASE, 1, { multiplier: 0.25, delta: -100000 }) === 0);

// The multiplier is the whole reason we don't store absolute prices: it stays correct at
// any distance. A ₹1150 seat on a ₹1000 leg must be ₹575 on a ₹500 leg, not still ₹1150.
check(
  'a seat rule stays correct on a SHORTER segment',
  seatFare(500, 1, { multiplier: 1.15 }) === 575,
);

console.log('\n── Bulk price moves ─────────────────────────────────');

let map: SeatFareMap = {};

const up5 = adjustSeatFares(map, SEATS, { percent: 5 });
check('+5% moves every seat on the bus', up5.ok && Object.keys(up5.map).length === 6, up5.ok && Object.keys(up5.map).length);
map = up5.ok ? up5.map : {};
check('+5% on a ₹1000 base = ₹1050', seatFare(BASE, 1, map['1A']) === 1050, seatFare(BASE, 1, map['1A']));

// Applying it twice compounds — which is what an operator means when they say it twice.
const again = adjustSeatFares(map, SEATS, { percent: 5 });
map = again.ok ? again.map : {};
check('+5% twice compounds to 1.1025', Math.abs(map['1A'].multiplier - 1.1025) < 0.0001, map['1A'].multiplier);

// Only the front row.
const front = adjustSeatFares(map, SEATS, { percent: 20, seats: ['1A', '1B'] });
map = front.ok ? front.map : {};
check('+20% on the front row only moves the front row', Math.abs(map['1A'].multiplier - 1.323) < 0.001, map['1A'].multiplier);
check('the back row is untouched', Math.abs(map['3A'].multiplier - 1.1025) < 0.0001, map['3A'].multiplier);

// Back row cheaper — the last seats to sell.
const back = adjustSeatFares(map, SEATS, { percent: -15, seats: ['3A', '3B'] });
map = back.ok ? back.map : {};
check('−15% on the back row discounts it', map['3A'].multiplier < map['2A'].multiplier, map['3A'].multiplier);

// Reset one seat to exactly standard.
const reset = adjustSeatFares(map, SEATS, { setMultiplier: 1, seats: ['1A'] });
map = reset.ok ? reset.map : {};
check('setMultiplier is a TARGET, not a change', map['1A'].multiplier === 1, map['1A'].multiplier);
check('setting one seat leaves the others alone', map['1B'].multiplier !== 1, map['1B'].multiplier);

// A flat premium on lower berths.
const berth = adjustSeatFares(map, SEATS, { delta: 100, seats: ['1A', '2A', '3A'] });
map = berth.ok ? berth.map : {};
check('a flat premium applies to the named seats', map['1A'].delta === 100, map['1A'].delta);
check('₹1000 base + standard multiplier + ₹100 = ₹1100', seatFare(BASE, 1, map['1A']) === 1100, seatFare(BASE, 1, map['1A']));

console.log('\n── Refusals ─────────────────────────────────────────');

const ghost = adjustSeatFares(map, SEATS, { percent: 5, seats: ['99Z'] });
check('a seat that is not on the bus is refused', !ghost.ok && ghost.code === 'SEAT_NOT_ON_BUS');

const absurd = adjustSeatFares({}, SEATS, { setMultiplier: 50 });
check('an absurd multiplier is refused, not stored', !absurd.ok);

const crushed = adjustSeatFares({}, SEATS, { percent: -95 });
check('a −95% move is refused (below the floor)', !crushed.ok);

console.log('\n── The whole bus, one segment ───────────────────────');
const all = seatFares(SEATS, BASE, 1, map);
check('every seat is priced', Object.keys(all).length === 6);
check('the seats are NOT all the same price', new Set(Object.values(all)).size > 1, all);
console.log(`     ${JSON.stringify(all)}`);

console.log(`\n${'='.repeat(54)}\n  PASSED: ${pass}   FAILED: ${fail}\n${'='.repeat(54)}\n`);
process.exit(fail ? 1 : 0);
