/* Plain runnable test harness (runs via ts-node). Positive and negative cases. */
import { conflictingSeats, segmentsOverlap } from '../src/common/logic/seat-overlap.util';
import { segmentFare } from '../src/common/logic/fare.util';
import { computeBookingTax, reverseCommission } from '../src/common/logic/tax.util';
import {
  checkOperatorDuplicate,
  checkBusRegUnique,
  checkDriverBusAssignment,
  checkBusRouteForTrip,
  checkRouteChangeAllowed,
  checkOperatorAccess,
} from '../src/common/logic/invariants.util';
import {
  resolveOperatorRecipients,
  resolvePassengerRecipient,
  isCrossOperatorLeak,
  Recipient,
} from '../src/common/logic/email-recipient.util';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  \u2705 ' + name); }
  else { failed++; console.log('  \u274C ' + name); }
}
function section(t: string) { console.log('\n== ' + t + ' =='); }

// ---------- SEAT OVERLAP ----------
section('Seat overlap (multi-stop) — positive + negative');
const existing = [
  { seatNumber: '5', boardingOrder: 0, droppingOrder: 1 }, // Delhi->Jaipur
  { seatNumber: '5', boardingOrder: 1, droppingOrder: 3 }, // Jaipur->Udaipur
  { seatNumber: '6', boardingOrder: 0, droppingOrder: 3 }, // Delhi->Udaipur
];
check('non-overlapping legs same seat allowed (5 @ 0->1 ok earlier)', !segmentsOverlap(0,1,1,3));
check('NEG: seat 5 Delhi->Ajmer (0->2) BLOCKED', conflictingSeats(existing, ['5'], 0, 2).includes('5'));
check('NEG: seat 5 Ajmer->Udaipur (2->3) BLOCKED', conflictingSeats(existing, ['5'], 2, 3).includes('5'));
check('NEG: seat 6 any overlapping (1->2) BLOCKED', conflictingSeats(existing, ['6'], 1, 2).includes('6'));
check('POS: seat 7 free everywhere', conflictingSeats(existing, ['7'], 0, 3).length === 0);

// ---------- FARE ----------
section('Segment fare — positive + negative');
const stops = [
  { stopId: 'DEL', stopOrder: 0, fareFromOrigin: 0 },
  { stopId: 'JAI', stopOrder: 1, fareFromOrigin: 600 },
  { stopId: 'AJM', stopOrder: 2, fareFromOrigin: 900 },
  { stopId: 'UDR', stopOrder: 3, fareFromOrigin: 1400 },
];
check('POS: DEL->UDR = 1400', segmentFare(stops, 'DEL', 'UDR') === 1400);
check('POS: JAI->AJM = 300', segmentFare(stops, 'JAI', 'AJM') === 300);
check('NEG: reverse UDR->DEL invalid (-1)', segmentFare(stops, 'UDR', 'DEL') === -1);
check('NEG: same stop DEL->DEL invalid (-1)', segmentFare(stops, 'DEL', 'DEL') === -1);
check('NEG: unknown stop -1', segmentFare(stops, 'DEL', 'XXX') === -1);

// ---------- TAX / COMMISSION ----------
section('Tax / commission (GST/TCS/TDS) — positive + negative');
const t = computeBookingTax(1000, 0.03, undefined, true);
check('POS: AC fare GST 5% = 50', t.fareGst === 50);
check('POS: passenger pays 1050', t.payableByPassenger === 1050);
check('POS: commission 3% = 30', t.commissionBase === 30);
check('POS: commission GST 18% of 30 = 5.4', t.commissionGst === 5.4);
check('POS: TCS 1% = 10', t.tcs === 10);
check('POS: TDS 0.1% = 1', t.tds === 1);
check('POS: operator net = 1000-30-5.4-10-1 = 953.6', t.operatorNet === 953.6);
const nonAc = computeBookingTax(1000, 0.03, undefined, false);
check('POS: non-AC fare GST = 0', nonAc.fareGst === 0);
const opSpecific = computeBookingTax(1000, 0.05, undefined, true);
check('POS: per-operator 5% commission = 50', opSpecific.commissionBase === 50);
let threw = false;
try { computeBookingTax(-1, 0.03); } catch { threw = true; }
check('NEG: negative fare throws', threw);
threw = false;
try { computeBookingTax(1000, 1.5); } catch { threw = true; }
check('NEG: commission > 100% throws', threw);
const rev = reverseCommission(t);
check('POS: cancel reverses commission 30', rev.commissionReversed === 30);

// ---------- OPERATOR DEDUPE ----------
section('Operator dedupe — duplicates BLOCKED');
const existingOps = [{ gstin: '29ABCDE1234F1Z5', pan: 'ABCDE1234F', legalName: 'Sharma Travels', email: 'a@x.com', mobile: '9990001111' }];
check('POS: brand new operator ok', checkOperatorDuplicate({ gstin:'27ZZZZZ9999Z1Z1', pan:'ZZZZZ9999Z', legalName:'New Co', email:'new@x.com', mobile:'8880002222' }, existingOps).ok);
check('NEG: same GSTIN blocked', !checkOperatorDuplicate({ gstin:'29ABCDE1234F1Z5', pan:'X', legalName:'Y', email:'z@z.com', mobile:'1', }, existingOps).ok);
check('NEG: same email blocked', !checkOperatorDuplicate({ legalName:'Y', email:'A@X.com', mobile:'2' }, existingOps).ok);
check('NEG: same mobile blocked', !checkOperatorDuplicate({ legalName:'Y', email:'q@q.com', mobile:'9990001111' }, existingOps).ok);
check('NEG: same legal name blocked', !checkOperatorDuplicate({ legalName:'sharma travels', email:'q@q.com', mobile:'5' }, existingOps).ok);

// ---------- BUS REG UNIQUE ----------
section('Bus reg globally unique');
check('POS: new reg ok', checkBusRegUnique('RJ14 AB 9999', ['DL01CC1111']).ok);
check('NEG: dup reg (case/space-insensitive) blocked', !checkBusRegUnique('dl01 cc 1111', ['DL01CC1111']).ok);

// ---------- DRIVER 1:1 BUS ----------
section('Driver 1:1 bus + same operator');
check('POS: free driver -> free bus same op', checkDriverBusAssignment({ driverOperatorId:'op1', busOperatorId:'op1', driverCurrentBusId:null, busCurrentDriverId:null, requestedBusId:'busA', driverId:'drv1' }).ok);
check('NEG: driver already on another bus', !checkDriverBusAssignment({ driverOperatorId:'op1', busOperatorId:'op1', driverCurrentBusId:'busZ', busCurrentDriverId:null, requestedBusId:'busA', driverId:'drv1' }).ok);
check('NEG: bus already has a driver', !checkDriverBusAssignment({ driverOperatorId:'op1', busOperatorId:'op1', driverCurrentBusId:null, busCurrentDriverId:'drvX', requestedBusId:'busA', driverId:'drv1' }).ok);
check('NEG: cross-operator driver/bus', !checkDriverBusAssignment({ driverOperatorId:'op1', busOperatorId:'op2', driverCurrentBusId:null, busCurrentDriverId:null, requestedBusId:'busA', driverId:'drv1' }).ok);

// ---------- ONE BUS ONE ROUTE ----------
section('One bus -> one active route');
check('POS: trip on mapped route', checkBusRouteForTrip('routeA', 'routeA').ok);
check('NEG: trip on different route', !checkBusRouteForTrip('routeA', 'routeB').ok);
check('NEG: bus not mapped', !checkBusRouteForTrip(null, 'routeA').ok);
check('POS: route change clean (0 pending)', checkRouteChangeAllowed(0).ok);
check('NEG: route change with pending trips', !checkRouteChangeAllowed(3).ok);

// ---------- OPERATOR ACCESS ----------
section('Operator isolation');
check('POS: superadmin cross-operator', checkOperatorAccess('SUPERADMIN', null, 'op2').ok);
check('POS: same-operator staff', checkOperatorAccess('ACCOUNTANT', 'op1', 'op1').ok);
check('NEG: operator A staff -> operator B data', !checkOperatorAccess('SUPPORT', 'op1', 'op2').ok);

// ---------- EMAIL OPERATOR ISOLATION ----------
section('Email isolation — operator ka mail doosre operator ko NA jaaye');
const people: Recipient[] = [
  { email:'admin1@op1.com', operatorId:'op1', role:'OPERATOR_ADMIN' },
  { email:'acc1@op1.com', operatorId:'op1', role:'ACCOUNTANT' },
  { email:'admin2@op2.com', operatorId:'op2', role:'OPERATOR_ADMIN' },
  { email:'rider@gmail.com', operatorId:null, role:'USER' },
];
const op1Recips = resolveOperatorRecipients(people, 'op1');
check('POS: op1 notification -> only op1 staff (2)', op1Recips.length === 2);
check('NEG-GUARD: no op2 recipient leaked into op1 set', !op1Recips.some(r => r.operatorId === 'op2'));
const op2Admin = resolveOperatorRecipients(people, 'op2', ['OPERATOR_ADMIN']);
check('POS: op2 admin-only filter -> 1', op2Admin.length === 1 && op2Admin[0].email === 'admin2@op2.com');
const rider = resolvePassengerRecipient(people, 'RIDER@gmail.com');
check('POS: passenger resolve (case-insensitive) -> 1', rider.length === 1);
check('NEG-GUARD: passenger set has no operator staff', !rider.some(r => r.operatorId !== null));
check('GUARD: cross-operator leak detector true for mismatched', isCrossOperatorLeak('op1','op2') === true);
check('GUARD: same-operator not a leak', isCrossOperatorLeak('op1','op1') === false);

// ---------- SUMMARY ----------
console.log('\n========================================');
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
console.log('========================================');
if (failed > 0) process.exit(1);

// ===== PHASE 1 & 2 ADDITIONS =====
import { verifyOtp, canResend, OTP_TTL_MS } from '../src/common/logic/otp.util';
import { computeRefund, refundPercent } from '../src/common/logic/refund.util';
import { computePayout } from '../src/common/logic/settlement.util';
import { haversineKm, etaMinutes } from '../src/common/logic/eta.util';

section('OTP policy — positive + negative');
const now = Date.now();
const okState = { codeHash: 'H', expiresAt: now + OTP_TTL_MS, attempts: 0, lastSentAt: now };
check('POS: correct otp verifies', verifyOtp(okState, 'H', now).ok);
check('NEG: wrong otp', !verifyOtp(okState, 'X', now).ok);
check('NEG: expired otp', !verifyOtp({ ...okState, expiresAt: now - 1 }, 'H', now).ok);
check('NEG: max attempts', !verifyOtp({ ...okState, attempts: 5 }, 'H', now).ok);
check('NEG: no request', !verifyOtp(null, 'H', now).ok);
check('POS: resend after cooldown', canResend({ ...okState, lastSentAt: now - 40000 }, now).ok);
check('NEG: resend within cooldown blocked', !canResend({ ...okState, lastSentAt: now - 5000 }, now).ok);

section('Refund slabs — positive + negative');
check('POS: >24h => 90%', refundPercent(30) === 0.90);
check('POS: 12-24h => 50%', refundPercent(18) === 0.50);
check('POS: 4-12h => 25%', refundPercent(6) === 0.25);
check('NEG: <4h => 0%', refundPercent(2) === 0);
const r = computeRefund(1000, 30);
check('POS: refund 900, charge 100', r.refundAmount === 900 && r.cancellationCharge === 100);
let rThrew = false; try { computeRefund(-5, 30); } catch { rThrew = true; }
check('NEG: negative amount throws', rThrew);


section('Settlement payout — positive');
const p = computePayout({ collectedBaseFare: 10000, commissionBase: 300, commissionGst: 54, tcs: 100, tds: 10, refundsPaid: 500 });
check('POS: payout = 10000-300-54-100-10-500 = 9036', p.payout === 9036);
check('POS: platform earning = 354', p.platformEarning === 354);

section('ETA / distance — positive + negative');
const d = haversineKm(28.6139, 77.2090, 26.9124, 75.7873); // Delhi->Jaipur ~ 240km
check('POS: Delhi-Jaipur distance ~240km (±30)', d > 210 && d < 280);
check('POS: ETA > 0 for distance', etaMinutes(d) > 0);
check('NEG: ETA 0 for zero distance', etaMinutes(0) === 0);

console.log('\n>>> Phase 1 & 2 logic additions checked <<<');

// ===== PHASE 3 ADDITIONS =====
import { computePriceMultiplier, demandMultiplier, urgencyMultiplier } from '../src/common/logic/pricing.util';
import { computeInsurance } from '../src/common/logic/insurance.util';
import { isSeatSellableOnChannel, applySale } from '../src/common/logic/channel-sync.util';

section('Dynamic pricing - positive + negative');
check('POS: empty bus early => discount (<1)', computePriceMultiplier({ occupancyRatio: 0, hoursToDeparture: 100, isWeekend: false }) < 1);
check('POS: full bus + last 6h => surge (>1.5)', computePriceMultiplier({ occupancyRatio: 1, hoursToDeparture: 3, isWeekend: false }) > 1.5);
check('POS: weekend adds surcharge', computePriceMultiplier({ occupancyRatio: 0.5, hoursToDeparture: 48, isWeekend: true }) > computePriceMultiplier({ occupancyRatio: 0.5, hoursToDeparture: 48, isWeekend: false }));
check('NEG: multiplier never exceeds max 2.0', computePriceMultiplier({ occupancyRatio: 1, hoursToDeparture: 1, isWeekend: true }) <= 2.0);
check('NEG: multiplier never below min 0.8', computePriceMultiplier({ occupancyRatio: 0, hoursToDeparture: 999, isWeekend: false }) >= 0.8);
check('POS: demand grows with occupancy', demandMultiplier(1) > demandMultiplier(0));
check('POS: urgency higher near departure', urgencyMultiplier(3) > urgencyMultiplier(100));

section('Insurance - positive + negative');
const ins = computeInsurance(2);
check('POS: 2 pax premium 30 + GST 5.4 = 35.4', ins.premium === 30 && ins.gst === 5.4 && ins.total === 35.4);
let insThrew = false; try { computeInsurance(0); } catch { insThrew = true; }
check('NEG: zero passengers throws', insThrew);

section('Channel/OTA inventory sync - positive + negative');
const inv = { tripId: 't1', soldSeats: ['1', '2'] };
check('POS: free seat sellable on channel', isSeatSellableOnChannel(inv, ['3']).ok);
check('NEG: already-sold seat blocked cross-channel', !isSeatSellableOnChannel(inv, ['2']).ok);
const inv2 = applySale(inv, ['3']);
check('POS: applySale marks seat sold everywhere', inv2.soldSeats.includes('3'));
check('NEG: after sale, that seat blocked on other channel', !isSeatSellableOnChannel(inv2, ['3']).ok);
console.log('\n>>> Phase 3 logic additions checked <<<');

// ===== PHASE 4 ADDITIONS =====
import { isValidRating, averageRating } from '../src/common/logic/rating.util';

section('Reviews & ratings - positive + negative');
check('POS: rating 4 valid', isValidRating(4));
check('NEG: rating 6 invalid', !isValidRating(6));
check('NEG: rating 0 invalid', !isValidRating(0));
check('NEG: rating 3.5 invalid (non-integer)', !isValidRating(3.5));
check('POS: average of [5,4,3] = 4', averageRating([5, 4, 3]) === 4);
check('POS: average of empty = 0', averageRating([]) === 0);
console.log('\n>>> Phase 4 logic additions checked <<<');

// ===== GOVERNANCE: delete permissions =====
import { canDelete } from '../src/common/logic/delete-permission.util';
section('Delete permissions - positive + negative');
check('NEG: operator-admin cannot delete USER', !canDelete('OPERATOR_ADMIN', 'USER').ok);
check('NEG: operator-admin cannot delete BOOKING', !canDelete('OPERATOR_ADMIN', 'BOOKING').ok);
check('NEG: operator-admin cannot delete PAYMENT', !canDelete('OPERATOR_ADMIN', 'PAYMENT').ok);
check('POS: operator-admin can soft-delete BUS', canDelete('OPERATOR_ADMIN', 'BUS').ok);
check('POS: superadmin can soft-delete OPERATOR', canDelete('SUPERADMIN', 'OPERATOR').ok);
check('NEG: nobody can delete BOOKING (immutable)', !canDelete('SUPERADMIN', 'BOOKING').ok);
check('NEG: nobody can delete AUDIT', !canDelete('SUPERADMIN', 'AUDIT').ok);
check('NEG: support cannot delete BUS', !canDelete('SUPPORT', 'BUS').ok);
console.log('\n>>> Governance delete-permission checks <<<');

// ===== GOVERNMENT NORMS: audit log filtering =====
import { matchesFilter, paginate } from '../src/common/logic/log-filter.util';
section('Audit log filter & pagination - positive + negative');
const log = { operatorId: 'op1', userId: 'u1', role: 'OPERATOR_ADMIN', method: 'POST', action: 'BusesController.create', createdAt: '2026-02-10T10:00:00.000Z' };
check('POS: matches operator filter', matchesFilter(log, { operatorId: 'op1' }));
check('NEG: different operator excluded', !matchesFilter(log, { operatorId: 'op2' }));
check('POS: matches role filter', matchesFilter(log, { role: 'OPERATOR_ADMIN' }));
check('NEG: different role excluded', !matchesFilter(log, { role: 'DRIVER' }));
check('POS: within date range', matchesFilter(log, { from: '2026-02-01', to: '2026-02-28' }));
check('NEG: before from-date excluded', !matchesFilter(log, { from: '2026-03-01' }));
check('POS: platform logs (operatorId null) selectable', matchesFilter({ ...log, operatorId: null }, { operatorId: null }));
const page = paginate([1,2,3,4,5], 2, 2);
check('POS: pagination page 2 size 2 => [3,4]', page.items[0] === 3 && page.items[1] === 4 && page.total === 5);
check('NEG: pagination clamps bad page to 1', paginate([1,2,3], 0, 50).page === 1);
console.log('\n>>> Government audit-log filter checks <<<');

// ===== MAINTENANCE WINDOW =====
import { validateDuration, isActive, dueReminderOffset, isWriteBlockedDuringMaintenance, overlaps } from '../src/common/logic/maintenance.util';
section('Maintenance window - positive + negative');
const t0 = new Date('2026-03-10T02:00:00.000Z').getTime();
const t45 = t0 + 45 * 60 * 1000;
check('POS: 45 min window valid', validateDuration(t0, t45).ok);
check('NEG: 20 min too short', !validateDuration(t0, t0 + 20 * 60 * 1000).ok);
check('NEG: 90 min too long', !validateDuration(t0, t0 + 90 * 60 * 1000).ok);
check('NEG: end before start invalid', !validateDuration(t45, t0).ok);
check('POS: active during window', isActive(t0 + 60000, t0, t45));
check('NEG: not active before window', !isActive(t0 - 60000, t0, t45));
check('POS: overlap detected', overlaps(t0, t45, t0 + 60000, t45 + 60000));
check('NEG: no overlap for separate windows', !overlaps(t0, t45, t45 + 3600000, t45 + 7200000));

section('Maintenance reminders - positive + negative');
const start = new Date('2026-03-10T02:00:00.000Z').getTime();
const day = 24 * 60 * 60 * 1000;
check('POS: 7-day reminder due exactly at 7 days before', dueReminderOffset(start - 7 * day, start, []) === 7);
check('POS: 1-day reminder due, 7..2 already sent', dueReminderOffset(start - 1 * day, start, [7,6,5,4,3,2]) === 1);
check('NEG: no reminder before 7-day mark', dueReminderOffset(start - 8 * day, start, []) === null);
check('NEG: no reminder after start', dueReminderOffset(start + 60000, start, []) === null);
check('NEG: already-sent offset not repeated', dueReminderOffset(start - 7 * day, start, [7]) !== 7);

section('Maintenance write-block - positive + negative');
check('NEG(blocked): operator PATCH bus during maintenance', isWriteBlockedDuringMaintenance('PATCH', '/api/v1/buses/123', 'OPERATOR_ADMIN'));
check('POS(allowed): passenger booking during maintenance', !isWriteBlockedDuringMaintenance('POST', '/api/v1/bookings', 'USER'));
check('POS(allowed): payment during maintenance', !isWriteBlockedDuringMaintenance('POST', '/api/v1/payments', 'USER'));
check('POS(allowed): GET during maintenance', !isWriteBlockedDuringMaintenance('GET', '/api/v1/buses', 'OPERATOR_ADMIN'));
check('POS(allowed): superadmin bypasses maintenance', !isWriteBlockedDuringMaintenance('DELETE', '/api/v1/admin/buses/1', 'SUPERADMIN'));
console.log('\n>>> Maintenance window checks <<<');

console.log('\n========== FINAL TOTAL ==========');
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
console.log('=================================');
process.exit(failed > 0 ? 1 : 0);
