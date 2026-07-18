/* Extended property-based logic tests (positive + negative). Runnable via ts-node. */
import { computeBookingTax, DEFAULT_TAX_CONFIG } from '../src/common/logic/tax.util';
import { segmentFare, RouteStopFare } from '../src/common/logic/fare.util';
import { occupiedSeats, conflictingSeats } from '../src/common/logic/seat-overlap.util';
import { computePriceMultiplier, demandMultiplier, urgencyMultiplier } from '../src/common/logic/pricing.util';
import { computeRefund, refundPercent } from '../src/common/logic/refund.util';
import { computePayout } from '../src/common/logic/settlement.util';
import { haversineKm, etaMinutes } from '../src/common/logic/eta.util';
import { isValidRating, averageRating } from '../src/common/logic/rating.util';
import { computeInsurance } from '../src/common/logic/insurance.util';
import { isSeatSellableOnChannel, applySale } from '../src/common/logic/channel-sync.util';
import { validateDuration, dueReminderOffset, isWriteBlockedDuringMaintenance, overlaps } from '../src/common/logic/maintenance.util';
import { matchesFilter, paginate } from '../src/common/logic/log-filter.util';
import { canDelete, ResourceType } from '../src/common/logic/delete-permission.util';
import { checkOperatorDuplicate, checkBusRegUnique, checkDriverBusAssignment } from '../src/common/logic/invariants.util';
import { validateSeatGenderAssignment } from '../src/common/logic/seat-gender.util';

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(label: string, cond: boolean): void {
  if (cond) passed++;
  else {
    failed++;
    failures.push(label);
  }
}
function section(name: string): void {
  // grouping only
  void name;
}
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------- Tax: property grid ----------
section('tax-grid');
for (let base = 100; base <= 2000; base += 100) {
  for (const comm of [0.02, 0.03, 0.05]) {
    const t = computeBookingTax(base, comm, DEFAULT_TAX_CONFIG, true);
    check(`tax payable>=base (base=${base},c=${comm})`, t.payableByPassenger >= base);
    check(`tax payable<=base*1.06 (base=${base},c=${comm})`, t.payableByPassenger <= base * 1.06 + 0.01);
    check(`tax fareGst>=0 (base=${base},c=${comm})`, t.fareGst >= 0);
    check(`tax commissionBase in [0,base] (base=${base},c=${comm})`, t.commissionBase >= 0 && t.commissionBase <= base + 0.01);
    check(`tax operatorNet<=base (base=${base},c=${comm})`, t.operatorNet <= base + 0.01);
    check(`tax all finite (base=${base},c=${comm})`, [t.fareGst, t.commissionBase, t.commissionGst, t.tcs, t.tds, t.operatorNet].every(Number.isFinite));
  }
}

// ---------- Fare: monotonic segments ----------
section('fare-monotonic');
const fares: RouteStopFare[] = [
  { stopId: 'a', stopOrder: 0, fareFromOrigin: 0 },
  { stopId: 'b', stopOrder: 1, fareFromOrigin: 100 },
  { stopId: 'c', stopOrder: 2, fareFromOrigin: 250 },
  { stopId: 'd', stopOrder: 3, fareFromOrigin: 450 },
  { stopId: 'e', stopOrder: 4, fareFromOrigin: 700 },
];
const ids = ['a', 'b', 'c', 'd', 'e'];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const f = segmentFare(fares, ids[i], ids[j], 1);
    check(`fare positive ${ids[i]}->${ids[j]}`, f > 0);
    check(`fare matches diff ${ids[i]}->${ids[j]}`, f === fares[j].fareFromOrigin - fares[i].fareFromOrigin);
  }
}
check('fare reverse direction invalid', segmentFare(fares, 'd', 'b', 1) < 0);
check('fare same stop invalid', segmentFare(fares, 'c', 'c', 1) <= 0);
for (const m of [1, 1.25, 1.5, 2]) {
  check(`fare multiplier ${m}`, segmentFare(fares, 'a', 'e', m) === round2(700 * m));
}

// ---------- Seat overlap ----------
section('seat-overlap');
const existing = [{ seatNumber: '1', boardingOrder: 2, droppingOrder: 5 }];
const cases: Array<[number, number, boolean]> = [
  [0, 2, false],
  [5, 7, false],
  [3, 4, true],
  [1, 3, true],
  [4, 6, true],
  [0, 6, true],
  [5, 6, false],
  [0, 1, false],
];
for (const [b, d, expected] of cases) {
  const occ = occupiedSeats(existing, b, d);
  check(`occupied [${b},${d}) === ${expected}`, occ.has('1') === expected);
  const conf = conflictingSeats(existing, ['1'], b, d);
  check(`conflict [${b},${d}) === ${expected}`, (conf.length > 0) === expected);
}

// ---------- Pricing grid (clamped) ----------
section('pricing-grid');
for (const occ of [0, 0.25, 0.5, 0.75, 1]) {
  for (const hrs of [1, 3, 6, 12, 24, 48, 72, 100]) {
    for (const weekend of [false, true]) {
      const m = computePriceMultiplier({ occupancyRatio: occ, hoursToDeparture: hrs, isWeekend: weekend });
      check(`price within band occ=${occ} h=${hrs} w=${weekend}`, m >= 0.8 && m <= 2.0);
    }
  }
}
check('demand grows with occupancy', demandMultiplier(1) > demandMultiplier(0));
check('urgency higher near departure', urgencyMultiplier(3) > urgencyMultiplier(100));
for (const occ of [0.1, 0.4, 0.9]) {
  check(`weekend >= weekday occ=${occ}`, computePriceMultiplier({ occupancyRatio: occ, hoursToDeparture: 48, isWeekend: true }) >= computePriceMultiplier({ occupancyRatio: occ, hoursToDeparture: 48, isWeekend: false }));
}

// ---------- Refund slabs ----------
section('refund');
const refundCases: Array<[number, number]> = [
  [30, 0.9],
  [24, 0.9],
  [23.9, 0.5],
  [12, 0.5],
  [11.9, 0.25],
  [4, 0.25],
  [3.9, 0],
  [0, 0],
];
for (const [hrs, pct] of refundCases) {
  check(`refundPercent(${hrs}) === ${pct}`, refundPercent(hrs) === pct);
}
for (let amount = 100; amount <= 2000; amount += 100) {
  for (const hrs of [30, 18, 6, 2]) {
    const r = computeRefund(amount, hrs);
    check(`refund<=amount a=${amount} h=${hrs}`, r.refundAmount <= amount);
    check(`charge>=0 a=${amount} h=${hrs}`, r.cancellationCharge >= 0);
    check(`refund+charge≈amount a=${amount} h=${hrs}`, Math.abs(r.refundAmount + r.cancellationCharge - amount) < 0.02);
  }
}

// ---------- Wallet ----------
section('settlement');
for (let collected = 1000; collected <= 5000; collected += 1000) {
  const p = computePayout({ collectedBaseFare: collected, commissionBase: collected * 0.03, commissionGst: collected * 0.03 * 0.18, tcs: collected * 0.01, tds: collected * 0.001, refundsPaid: 0 });
  check(`payout < collected c=${collected}`, p.payout < collected);
  check(`platform earning > 0 c=${collected}`, p.platformEarning > 0);
}

// ---------- ETA / distance ----------
section('eta');
let prevEta = -1;
for (let d = 0; d <= 500; d += 50) {
  const e = etaMinutes(d);
  check(`eta>=0 d=${d}`, e >= 0);
  check(`eta monotonic d=${d}`, e >= prevEta);
  prevEta = e;
}
check('haversine same point 0', haversineKm(28.6, 77.2, 28.6, 77.2) === 0);
check('haversine symmetric', haversineKm(28.6, 77.2, 19.07, 72.87) === haversineKm(19.07, 72.87, 28.6, 77.2));

// ---------- Loyalty ----------
section('rating');
for (let r = -2; r <= 7; r++) {
  check(`rating ${r} validity`, isValidRating(r) === (r >= 1 && r <= 5));
}
check('rating 3.5 invalid', !isValidRating(3.5));
check('average [5,4,3]=4', averageRating([5, 4, 3]) === 4);
check('average [1,2]=1.5', averageRating([1, 2]) === 1.5);
check('average empty=0', averageRating([]) === 0);

// ---------- Insurance ----------
section('insurance');
for (let n = 1; n <= 10; n++) {
  const ins = computeInsurance(n);
  check(`insurance premium n=${n}`, ins.premium === round2(15 * n));
  check(`insurance gst n=${n}`, ins.gst === round2(ins.premium * 0.18));
  check(`insurance total n=${n}`, ins.total === round2(ins.premium + ins.gst));
}
let insThrew = false;
try {
  computeInsurance(0);
} catch {
  insThrew = true;
}
check('insurance zero pax throws', insThrew);

// ---------- Channel sync ----------
section('channel');
let inv = { tripId: 't', soldSeats: ['1', '2'] };
check('free seat sellable', isSeatSellableOnChannel(inv, ['3']).ok);
check('sold seat blocked', !isSeatSellableOnChannel(inv, ['2']).ok);
inv = applySale(inv, ['3', '4']);
check('applySale adds seats', inv.soldSeats.includes('3') && inv.soldSeats.includes('4'));
check('after sale blocked cross-channel', !isSeatSellableOnChannel(inv, ['4']).ok);
check('applySale idempotent', applySale(inv, ['3']).soldSeats.filter((s) => s === '3').length === 1);

// ---------- Maintenance ----------
section('maintenance');
const base0 = Date.UTC(2026, 5, 1, 2, 0, 0);
for (let mins = 1; mins <= 120; mins += 1) {
  const ok = validateDuration(base0, base0 + mins * 60000).ok;
  check(`duration ${mins}min validity`, ok === (mins >= 30 && mins <= 60));
}
const day = 24 * 60 * 60 * 1000;
for (let d = 7; d >= 1; d--) {
  const sent: number[] = [];
  for (let x = 7; x > d; x--) sent.push(x);
  check(`reminder due at ${d} days`, dueReminderOffset(base0 - d * day, base0, sent) === d);
}
check('no reminder before 7 days', dueReminderOffset(base0 - 8 * day, base0, []) === null);
check('no reminder after start', dueReminderOffset(base0 + 60000, base0, []) === null);
check('windows overlap detected', overlaps(0, 100, 50, 150));
check('windows no overlap', !overlaps(0, 100, 100, 200));

// ---------- Maintenance write-block grid ----------
section('maintenance-block');
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const roles = ['USER', 'OPERATOR_ADMIN', 'SUPERADMIN', 'SUPPORT'];
const paths = ['/api/v1/bookings', '/api/v1/payments', '/api/v1/otp/verify', '/api/v1/buses/1', '/api/v1/admin/buses/1', '/api/v1/routes/1'];
for (const m of methods) {
  for (const role of roles) {
    for (const path of paths) {
      const blocked = isWriteBlockedDuringMaintenance(m, path, role);
      const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
      const allow = ['/bookings', '/payments', '/otp', '/auth', '/operators/apply', '/maintenance', '/health', '/tracking'].some((p) => path.toLowerCase().includes(p));
      const expected = mutating && role !== 'SUPERADMIN' && !allow;
      check(`block ${m} ${role} ${path}`, blocked === expected);
    }
  }
}

// ---------- Log filter / pagination ----------
section('log-filter');
const log = { operatorId: 'op1', userId: 'u1', role: 'OPERATOR_ADMIN', method: 'POST', action: 'X.create', createdAt: '2026-02-10T10:00:00.000Z' };
check('match op1', matchesFilter(log, { operatorId: 'op1' }));
check('exclude op2', !matchesFilter(log, { operatorId: 'op2' }));
check('match platform null', matchesFilter({ ...log, operatorId: null }, { operatorId: null }));
check('match role', matchesFilter(log, { role: 'OPERATOR_ADMIN' }));
check('exclude role', !matchesFilter(log, { role: 'DRIVER' }));
check('match method', matchesFilter(log, { method: 'POST' }));
check('exclude method', !matchesFilter(log, { method: 'GET' }));
check('date in range', matchesFilter(log, { from: '2026-02-01', to: '2026-02-28' }));
check('date before from', !matchesFilter(log, { from: '2026-03-01' }));
check('date after to', !matchesFilter(log, { to: '2026-01-01' }));
for (let total = 0; total <= 20; total++) {
  const items = Array.from({ length: total }, (_, i) => i);
  const pg = paginate(items, 1, 5);
  check(`paginate total=${total} count`, pg.total === total);
  check(`paginate total=${total} page size`, pg.items.length === Math.min(5, total));
}
check('paginate clamps page 0', paginate([1, 2, 3], 0, 10).page === 1);
check('paginate clamps size 0', paginate([1, 2, 3], 1, 0).pageSize >= 1);

// ---------- Delete permission grid ----------
section('delete-perm');
const resources: ResourceType[] = ['USER', 'BOOKING', 'PAYMENT', 'COMMISSION', 'INVOICE', 'SETTLEMENT', 'WALLET', 'AUDIT', 'BUS', 'DRIVER', 'ROUTE', 'STOP', 'TRIP', 'CHANNEL', 'OPERATOR'];
const immutable = ['BOOKING', 'PAYMENT', 'COMMISSION', 'INVOICE', 'SETTLEMENT', 'WALLET', 'AUDIT'];
const operatorForbidden = [...immutable, 'USER', 'OPERATOR'];
for (const res of resources) {
  const sa = canDelete('SUPERADMIN', res);
  check(`superadmin delete ${res}`, sa.ok === !immutable.includes(res));
  const oa = canDelete('OPERATOR_ADMIN', res);
  check(`operator delete ${res}`, oa.ok === !operatorForbidden.includes(res));
  const sup = canDelete('SUPPORT', res);
  check(`support delete ${res}`, sup.ok === false);
}

// ---------- Invariants ----------
section('invariants');
const existingOps = [{ gstin: 'G1', pan: 'P1', legalName: 'Acme', email: 'a@x.com', mobile: '9999999999' }];
check('dup gstin', !checkOperatorDuplicate({ gstin: 'G1', pan: 'P9', legalName: 'New', email: 'n@x.com', mobile: '8888888888' }, existingOps).ok);
check('dup pan', !checkOperatorDuplicate({ gstin: 'G9', pan: 'P1', legalName: 'New', email: 'n@x.com', mobile: '8888888888' }, existingOps).ok);
check('dup email', !checkOperatorDuplicate({ gstin: 'G9', pan: 'P9', legalName: 'New', email: 'a@x.com', mobile: '8888888888' }, existingOps).ok);
check('dup mobile', !checkOperatorDuplicate({ gstin: 'G9', pan: 'P9', legalName: 'New', email: 'n@x.com', mobile: '9999999999' }, existingOps).ok);
check('dup legalName', !checkOperatorDuplicate({ gstin: 'G9', pan: 'P9', legalName: 'acme', email: 'n@x.com', mobile: '8888888888' }, existingOps).ok);
check('no dup unique', checkOperatorDuplicate({ gstin: 'G9', pan: 'P9', legalName: 'New', email: 'n@x.com', mobile: '8888888888' }, existingOps).ok);
check('bus reg dup', !checkBusRegUnique('MH12AB1234', ['MH12AB1234']).ok);
check('bus reg unique', checkBusRegUnique('MH12AB9999', ['MH12AB1234']).ok);
check('driver cross-operator blocked', !checkDriverBusAssignment({ driverOperatorId: 'o1', busOperatorId: 'o2', driverCurrentBusId: null, busCurrentDriverId: null, requestedBusId: 'b1', driverId: 'd1' }).ok);
check('driver already assigned blocked', !checkDriverBusAssignment({ driverOperatorId: 'o1', busOperatorId: 'o1', driverCurrentBusId: 'bX', busCurrentDriverId: null, requestedBusId: 'b1', driverId: 'd1' }).ok);
check('bus already has driver blocked', !checkDriverBusAssignment({ driverOperatorId: 'o1', busOperatorId: 'o1', driverCurrentBusId: null, busCurrentDriverId: 'dX', requestedBusId: 'b1', driverId: 'd1' }).ok);
check('driver assignment valid', checkDriverBusAssignment({ driverOperatorId: 'o1', busOperatorId: 'o1', driverCurrentBusId: null, busCurrentDriverId: null, requestedBusId: 'b1', driverId: 'd1' }).ok);


// ===== BILLING & INVOICING (SuperAdmin) =====
import {
  isValidGstin, stateCodeFromGstin, computeGstSplit, computeSubtotal, formatInvoiceNumber,
  canVoidInvoice, canRecordPayment, statusAfterPayment, canApplyCreditNote, canApplyDebitNote,
} from '../src/common/logic/billing.util';
section('billing');
check('POS: valid gstin', isValidGstin('07AABCA1234A1Z5'));
check('NEG: invalid gstin length', !isValidGstin('07AABCA1234A1Z'));
check('NEG: invalid gstin pattern', !isValidGstin('AA07ABCA1234A1Z5'));
check('state code from gstin', stateCodeFromGstin('07AABCA1234A1Z5') === '07');
// Intra-state: same state => CGST + SGST
const intra = computeGstSplit(1000, 0.18, '07', '07');
check('intra cgst = 9%', intra.cgst === 90);
check('intra sgst = 9%', intra.sgst === 90);
check('intra igst = 0', intra.igst === 0);
check('intra total tax = 180', intra.totalTax === 180);
check('intra total = 1180', intra.total === 1180);
// Inter-state: different state => IGST full
const inter = computeGstSplit(1000, 0.18, '07', '27');
check('inter igst = 18%', inter.igst === 180);
check('inter cgst = 0', inter.cgst === 0);
check('inter total = 1180', inter.total === 1180);
check('subtotal sums line items', computeSubtotal([{ description: 'Plan', quantity: 2, unitPrice: 500 }, { description: 'Addon', quantity: 1, unitPrice: 200 }]) === 1200);
check('invoice number format', formatInvoiceNumber('INV', 2026, 123) === 'INV-2026-000123');
check('POS: void issued invoice', canVoidInvoice('ISSUED').ok);
check('POS: void draft invoice', canVoidInvoice('DRAFT').ok);
check('NEG: void paid invoice', !canVoidInvoice('PAID').ok);
check('NEG: void cancelled invoice', !canVoidInvoice('CANCELLED').ok);
check('POS: pay issued invoice', canRecordPayment('ISSUED').ok);
check('POS: pay partially paid', canRecordPayment('PARTIALLY_PAID').ok);
check('NEG: pay draft invoice', !canRecordPayment('DRAFT').ok);
check('NEG: pay already paid', !canRecordPayment('PAID').ok);
check('status PAID when fully paid', statusAfterPayment(1180, 0, 1180) === 'PAID');
check('status PARTIALLY_PAID when partial', statusAfterPayment(1180, 0, 500) === 'PARTIALLY_PAID');
check('status PAID when overpaid sum', statusAfterPayment(1180, 680, 500) === 'PAID');
check('POS: credit within invoice', canApplyCreditNote(1180, 0, 500).ok);
check('POS: credit up to remaining', canApplyCreditNote(1180, 680, 500).ok);
check('NEG: credit exceeds invoice', !canApplyCreditNote(1180, 800, 500).ok);
check('NEG: credit zero amount', !canApplyCreditNote(1180, 0, 0).ok);
check('POS: debit on issued invoice', canApplyDebitNote('ISSUED', 100).ok);
check('NEG: debit on void invoice', !canApplyDebitNote('VOID', 100).ok);
check('NEG: debit zero amount', !canApplyDebitNote('ISSUED', 0).ok);
console.log('\n>>> Billing & invoicing checks <<<');


// ===== OPERATOR MANAGEMENT (SuperAdmin) =====
import {
  canTransition, emptyChecklist, pendingOnboardingSteps, onboardingComplete,
  canActivate, canSuspend, canReactivate, canHardDelete, OnboardingChecklist,
} from '../src/common/logic/operator-lifecycle.util';
section('operator-management');
check('POS: provisioning->onboarding', canTransition('PROVISIONING', 'ONBOARDING').ok);
check('POS: onboarding->active', canTransition('ONBOARDING', 'ACTIVE').ok);
check('POS: active->suspended', canTransition('ACTIVE', 'SUSPENDED').ok);
check('POS: suspended->active', canTransition('SUSPENDED', 'ACTIVE').ok);
check('NEG: provisioning->active (skip onboarding)', !canTransition('PROVISIONING', 'ACTIVE').ok);
check('NEG: deleted->active', !canTransition('DELETED', 'ACTIVE').ok);
check('NEG: active->provisioning', !canTransition('ACTIVE', 'PROVISIONING').ok);
const empty = emptyChecklist();
check('empty checklist has 7 pending', pendingOnboardingSteps(empty).length === 7);
check('empty checklist not complete', !onboardingComplete(empty));
const full: OnboardingChecklist = { kycCompleted: true, gstUploaded: true, documentsUploaded: true, mobileVerified: true, emailVerified: true, termsAccepted: true, adminCreated: true };
check('full checklist complete', onboardingComplete(full));
check('full checklist zero pending', pendingOnboardingSteps(full).length === 0);
const partial = { ...full, emailVerified: false };
check('partial checklist has 1 pending', pendingOnboardingSteps(partial).length === 1);
check('POS: activate when onboarding complete', canActivate('ONBOARDING', full).ok);
check('NEG: activate when onboarding incomplete', !canActivate('ONBOARDING', partial).ok);
check('NEG: activate when already active', !canActivate('ACTIVE', full).ok);
check('NEG: activate from provisioning (bad transition)', !canActivate('PROVISIONING', full).ok);
check('POS: suspend active operator', canSuspend('ACTIVE').ok);
check('POS: suspend onboarding operator', canSuspend('ONBOARDING').ok);
check('NEG: suspend provisioning operator', !canSuspend('PROVISIONING').ok);
check('NEG: suspend already suspended', !canSuspend('SUSPENDED').ok);
check('POS: reactivate suspended', canReactivate('SUSPENDED').ok);
check('NEG: reactivate active', !canReactivate('ACTIVE').ok);
check('POS: hard delete demo operator', canHardDelete('ACTIVE', true).ok);
check('POS: hard delete soft-deleted operator', canHardDelete('DELETED', false).ok);
check('NEG: hard delete active non-demo', !canHardDelete('ACTIVE', false).ok);
console.log('\n>>> Operator management checks <<<');


// ===== PLATFORM CONFIGURATION (SuperAdmin) =====
import {
  validateSetting, isValidEmail, isValidCurrency, isValidLanguage, isValidTimezone, isValidStateCode,
  evaluateFlag, diffConfig, FeatureFlagState,
} from '../src/common/logic/platform-config.util';
section('platform-config');
check('email valid', isValidEmail('help@yoobus.com'));
check('email invalid', !isValidEmail('help@@x'));
check('currency valid INR', isValidCurrency('INR'));
check('currency invalid', !isValidCurrency('Rupee'));
check('language valid en', isValidLanguage('en'));
check('language valid en-IN', isValidLanguage('en-IN'));
check('language invalid', !isValidLanguage('English'));
check('timezone valid', isValidTimezone('Asia/Kolkata'));
check('timezone UTC', isValidTimezone('UTC'));
check('timezone invalid', !isValidTimezone('IST'));
check('state code valid', isValidStateCode('07'));
check('state code invalid', !isValidStateCode('7'));
check('POS: set support email', validateSetting('GENERAL', 'supportEmail', 'help@yoobus.com').ok);
check('NEG: bad support email', !validateSetting('GENERAL', 'supportEmail', 'nope').ok);
check('POS: set currency', validateSetting('LOCALIZATION', 'defaultCurrency', 'INR').ok);
check('NEG: bad currency', !validateSetting('LOCALIZATION', 'defaultCurrency', 'Rupee').ok);
check('POS: set timezone', validateSetting('LOCALIZATION', 'defaultTimezone', 'Asia/Kolkata').ok);
check('POS: mfaRequired boolean', validateSetting('SECURITY', 'mfaRequired', true).ok);
check('NEG: mfaRequired non-boolean', !validateSetting('SECURITY', 'mfaRequired', 'yes').ok);
check('POS: passwordMinLength int', validateSetting('SECURITY', 'passwordMinLength', 8).ok);
check('NEG: passwordMinLength negative', !validateSetting('SECURITY', 'passwordMinLength', -1).ok);
check('NEG: passwordMinLength fractional', !validateSetting('SECURITY', 'passwordMinLength', 8.5).ok);
check('POS: gst rate valid', validateSetting('PAYMENT', 'defaultGstRate', 0.18).ok);
check('NEG: gst rate >1', !validateSetting('PAYMENT', 'defaultGstRate', 1.5).ok);
check('POS: state code setting', validateSetting('GENERAL', 'supplierStateCode', '07').ok);
check('NEG: unknown setting key rejected', !validateSetting('GENERAL', 'randomKey', 'x').ok);
// Feature flags
const flagOn: FeatureFlagState = { enabledGlobally: true };
const flagOff: FeatureFlagState = { enabledGlobally: false };
check('flag on globally', evaluateFlag(flagOn, null, Date.now()));
check('flag off globally', !evaluateFlag(flagOff, null, Date.now()));
const overrideFlag: FeatureFlagState = { enabledGlobally: false, operatorOverrides: { 't1': true } };
check('operator override on beats global off', evaluateFlag(overrideFlag, 't1', Date.now()));
check('non-overridden operator uses global', !evaluateFlag(overrideFlag, 't2', Date.now()));
const future = Date.now() + 86400000;
const scheduled: FeatureFlagState = { enabledGlobally: true, scheduledAt: future };
check('scheduled flag off before time', !evaluateFlag(scheduled, null, Date.now()));
check('scheduled flag on after time', evaluateFlag(scheduled, null, future + 1000));
check('override beats schedule', evaluateFlag({ enabledGlobally: true, scheduledAt: future, operatorOverrides: { 't1': true } }, 't1', Date.now()));
// Config diff (version compare)
check('diff detects changed key', diffConfig({ a: 1, b: 2 }, { a: 1, b: 3 }).join(',') === 'b');
check('diff detects added key', diffConfig({ a: 1 }, { a: 1, c: 9 }).join(',') === 'c');
check('diff empty when equal', diffConfig({ a: 1 }, { a: 1 }).length === 0);
console.log('\n>>> Platform configuration checks <<<');


// ===== SINGLE SOURCE OF TRUTH (no duplicated config) =====
import {
  PLATFORM_DEFAULTS, platformDefault, SEAT_HOLD_TTL_MINUTES, PAYMENT_WINDOW_MINUTES,
  RESCHEDULE_MIN_HOURS_BEFORE_DEPARTURE, DEFAULT_GST_RATE, DEFAULT_SUPPLIER_STATE_CODE, OTP_TTL_MS,
} from '../src/common/config/platform-defaults';
import * as appConstants from '../src/common/constants/app.constants';
section('single-source-of-truth');
check('seat hold flat == nested', SEAT_HOLD_TTL_MINUTES === PLATFORM_DEFAULTS.BOOKING.seatHoldMinutes);
check('payment window flat == nested', PAYMENT_WINDOW_MINUTES === PLATFORM_DEFAULTS.BOOKING.paymentWindowMinutes);
check('reschedule hours flat == nested', RESCHEDULE_MIN_HOURS_BEFORE_DEPARTURE === PLATFORM_DEFAULTS.BOOKING.rescheduleMinHoursBeforeDeparture);
check('gst rate flat == nested', DEFAULT_GST_RATE === PLATFORM_DEFAULTS.PAYMENT.defaultGstRate);
check('supplier state flat == nested', DEFAULT_SUPPLIER_STATE_CODE === PLATFORM_DEFAULTS.GENERAL.supplierStateCode);
check('otp ttl derived from minutes', OTP_TTL_MS === PLATFORM_DEFAULTS.OTP.ttlMinutes * 60 * 1000);
// app.constants must re-export the SAME single-source values (not redefine them)
check('app.constants seat hold === source', appConstants.SEAT_HOLD_TTL_MINUTES === PLATFORM_DEFAULTS.BOOKING.seatHoldMinutes);
check('app.constants payment window === source', appConstants.PAYMENT_WINDOW_MINUTES === PLATFORM_DEFAULTS.BOOKING.paymentWindowMinutes);
check('app.constants reschedule === source', appConstants.RESCHEDULE_MIN_HOURS_BEFORE_DEPARTURE === PLATFORM_DEFAULTS.BOOKING.rescheduleMinHoursBeforeDeparture);
check('platformDefault reads nested value', platformDefault('PAYMENT', 'tcsRate') === PLATFORM_DEFAULTS.PAYMENT.tcsRate);
check('platformDefault unknown ns undefined', platformDefault('NOPE', 'x') === undefined);
console.log('\n>>> Single-source-of-truth checks <<<');


// ===== API MANAGEMENT (SuperAdmin) =====
import {
  partnerCanTransition, canUseApiKey, maskApiKey, hasScopes, computeWebhookSignature,
  verifyWebhookSignature, withinRateLimit, rateLimitWindowExpired, isVersionUsable,
  shouldRetryWebhook, backoffSeconds,
} from '../src/common/logic/api-management.util';
section('api-management');
check('POS: pending->approved', partnerCanTransition('PENDING', 'APPROVED').ok);
check('POS: pending->rejected', partnerCanTransition('PENDING', 'REJECTED').ok);
check('POS: approved->suspended', partnerCanTransition('APPROVED', 'SUSPENDED').ok);
check('POS: suspended->approved', partnerCanTransition('SUSPENDED', 'APPROVED').ok);
check('NEG: rejected->approved', !partnerCanTransition('REJECTED', 'APPROVED').ok);
check('NEG: pending->suspended', !partnerCanTransition('PENDING', 'SUSPENDED').ok);
const now = Date.now();
check('POS: active key usable', canUseApiKey('ACTIVE', null, now).ok);
check('POS: active key before expiry', canUseApiKey('ACTIVE', now + 10000, now).ok);
check('NEG: revoked key', !canUseApiKey('REVOKED', null, now).ok);
check('NEG: expired status', !canUseApiKey('EXPIRED', null, now).ok);
check('NEG: active key past expiry', !canUseApiKey('ACTIVE', now - 1000, now).ok);
check('mask key shows prefix+last4', maskApiKey('tbk_live_abcdef1234567890') === 'tbk_****7890');
check('mask short key hidden', maskApiKey('short') === '****');
check('POS: has all scopes', hasScopes(['read', 'write', 'book'], ['read', 'book']));
check('NEG: missing scope', !hasScopes(['read'], ['read', 'write']));
check('POS: empty required always satisfied', hasScopes([], []));
const sig = computeWebhookSignature('{"event":"booking.created"}', 'secret123');
check('signature deterministic', sig === computeWebhookSignature('{"event":"booking.created"}', 'secret123'));
check('signature is 64-hex (sha256)', /^[0-9a-f]{64}$/.test(sig));
check('signature differs with secret', sig !== computeWebhookSignature('{"event":"booking.created"}', 'other'));
check('POS: verify valid signature', verifyWebhookSignature('{"event":"booking.created"}', 'secret123', sig));
check('NEG: verify tampered payload', !verifyWebhookSignature('{"event":"booking.deleted"}', 'secret123', sig));
check('NEG: verify wrong signature length', !verifyWebhookSignature('x', 'secret123', 'abc'));
check('POS: within rate limit', withinRateLimit(50, 100));
check('NEG: at rate limit', !withinRateLimit(100, 100));
check('NEG: over rate limit', !withinRateLimit(101, 100));
check('POS: window expired', rateLimitWindowExpired(0, 60000, 60001));
check('NEG: window not expired', !rateLimitWindowExpired(0, 60000, 30000));
check('POS: active version usable', isVersionUsable('ACTIVE').ok);
check('POS: deprecated still usable', isVersionUsable('DEPRECATED').ok);
check('NEG: retired version unusable', !isVersionUsable('RETIRED').ok);
check('POS: retry while attempts remain', shouldRetryWebhook(2, 5));
check('NEG: no retry after max', !shouldRetryWebhook(5, 5));
check('backoff grows', backoffSeconds(0) === 5 && backoffSeconds(1) === 10 && backoffSeconds(2) === 20);
check('backoff capped at 1h', backoffSeconds(20) === 3600);
console.log('\n>>> API management checks <<<');


// ===== ACCESS RULES (single home: operator scope + ownership) =====
import { assertOperatorScope, assertResourceOwner } from '../src/common/logic/access.util';
import { Role as AccessRole } from '../src/common/enums/role.enum';
section('access-rules');
check('POS: superadmin acts cross-operator', assertOperatorScope(AccessRole.SUPERADMIN, 'op1', 'op2').ok);
check('POS: operator acts on own operator', assertOperatorScope(AccessRole.OPERATOR_ADMIN, 'op1', 'op1').ok);
check('NEG: operator acts on other operator', !assertOperatorScope(AccessRole.OPERATOR_ADMIN, 'op1', 'op2').ok);
check('NEG: support on other operator', !assertOperatorScope(AccessRole.SUPPORT, 'op1', 'op2').ok);
check('NEG: missing actor operator', !assertOperatorScope(AccessRole.OPERATOR_ADMIN, null, 'op1').ok);
check('operator scope error code', assertOperatorScope(AccessRole.OPERATOR_ADMIN, 'op1', 'op2').code === 'CROSS_OPERATOR_FORBIDDEN');
check('POS: user owns resource', assertResourceOwner(AccessRole.CUSTOMER, 'u1', 'u1').ok);
check('NEG: user not owner', !assertResourceOwner(AccessRole.CUSTOMER, 'u1', 'u2').ok);
check('POS: staff bypass ownership', assertResourceOwner(AccessRole.SUPPORT, 'u1', 'u2').ok);
check('POS: operator-admin bypass ownership', assertResourceOwner(AccessRole.OPERATOR_ADMIN, 'u1', 'u2').ok);
check('POS: superadmin bypass ownership', assertResourceOwner(AccessRole.SUPERADMIN, 'u1', 'u2').ok);
check('owner error code', assertResourceOwner(AccessRole.CUSTOMER, 'u1', 'u2').code === 'NOT_YOUR_RESOURCE');
console.log('\n>>> Access-rule checks <<<');


// ===== RBAC ENGINE (permission catalog + resolver) =====
import { resolveEffectivePermissions, hasPermission } from '../src/common/logic/permission-resolve.util';
import { PERMISSION_CATALOG, ALL_PERMISSIONS, permissionsForRole } from '../src/common/rbac/permission-catalog';
import { Role as RbacRole } from '../src/common/enums/role.enum';
section('rbac');
// resolver
check('resolve keeps base', resolveEffectivePermissions(['A', 'B'], []).join(',') === 'A,B');
check('resolve grant adds', resolveEffectivePermissions(['A'], [{ permissionKey: 'C', granted: true }]).includes('C'));
check('resolve revoke removes', !resolveEffectivePermissions(['A', 'B'], [{ permissionKey: 'B', granted: false }]).includes('B'));
check('resolve grant+revoke mix', resolveEffectivePermissions(['A'], [{ permissionKey: 'A', granted: false }, { permissionKey: 'D', granted: true }]).join(',') === 'D');
check('hasPermission all present', hasPermission(['A', 'B', 'C'], ['A', 'C']));
check('hasPermission missing', !hasPermission(['A'], ['A', 'B']));
// catalog integrity
const keys = PERMISSION_CATALOG.map((p) => p.key);
check('catalog non-empty', keys.length > 100);
check('no duplicate permission keys', new Set(keys).size === keys.length);
check('every permission has a role', PERMISSION_CATALOG.every((p) => p.roles.length > 0));
check('ALL_PERMISSIONS matches catalog', ALL_PERMISSIONS.length === keys.length);
// role mapping
const sa = permissionsForRole(RbacRole.SUPERADMIN);
const op = permissionsForRole(RbacRole.OPERATOR_ADMIN);
const dr = permissionsForRole(RbacRole.DRIVER);
const cu = permissionsForRole(RbacRole.CUSTOMER);
const ac = permissionsForRole(RbacRole.ACCOUNTANT);
check('superadmin can create operator', sa.includes('CREATE_OPERATOR'));
check('operator cannot create operator', !op.includes('CREATE_OPERATOR'));
check('operator can create bus', op.includes('CREATE_BUS'));
check('driver can scan QR', dr.includes('SCAN_QR'));
check('driver cannot create bus', !dr.includes('CREATE_BUS'));
check('customer can create booking', cu.includes('CREATE_BOOKING'));
check('customer cannot configure pricing', !cu.includes('CONFIGURE_DYNAMIC_PRICING'));
check('accountant is platform finance only', ac.includes('CREATE_SAAS_INVOICE') && !ac.includes('CREATE_BUS'));
// Platform-group permissions may only reach the platform roles, plus the two operator
// roles that legitimately read platform surfaces (an operator admin sees its own
// subscription; support sees its own tickets). A DRIVER or a CUSTOMER must never appear.
const PLATFORM_GROUP_ALLOWED = [
  RbacRole.SUPERADMIN,
  RbacRole.ACCOUNTANT,
  RbacRole.PLATFORM_SUPPORT,
  RbacRole.OPERATOR_ADMIN,
  RbacRole.SUPPORT,
];
const platformLeak = PERMISSION_CATALOG.filter(
  (p) => p.group.startsWith('PLATFORM_') && p.roles.some((r) => !PLATFORM_GROUP_ALLOWED.includes(r)),
);
check('no platform permission leaks outside the allowed roles', platformLeak.length === 0);

// The assertion that actually matters, stated directly rather than by omission.
const drvCustLeak = PERMISSION_CATALOG.filter(
  (p) => p.group.startsWith('PLATFORM_') && p.roles.some((r) => r === RbacRole.DRIVER || r === RbacRole.CUSTOMER),
);
check('NO platform permission is ever granted to a DRIVER or CUSTOMER', drvCustLeak.length === 0);

// PLATFORM_SUPPORT is a platform role: it must hold platform powers but never fleet powers.
const ps = permissionsForRole(RbacRole.PLATFORM_SUPPORT);
check('platform support can work tickets', ps.includes('VIEW_SUPPORT_TICKETS'));
check('platform support can search any booking', ps.includes('SEARCH_BOOKING'));
check('platform support can resolve a complaint', ps.includes('RESOLVE_COMPLAINT'));
check('platform support cannot configure global settings', !ps.includes('CONFIGURE_PLATFORM_SETTINGS'));
check('platform support cannot create a bus', !ps.includes('CREATE_BUS'));
check('platform support cannot create an operator', !ps.includes('CREATE_OPERATOR'));
console.log('\n>>> RBAC engine checks <<<');


// ===== PART 2: PLATFORM SURFACE (marketplace, compliance, reliability) =====
import { partnerCanTransition as mpTransition, isValidShare, validateShares } from '../src/common/logic/marketplace.util';
import { dsrCanTransition, isConsentGranted } from '../src/common/logic/compliance.util';
import { jobCanTransition, deploymentCanTransition } from '../src/common/logic/reliability.util';
section('platform-marketplace');
check('POS: pending->approved', mpTransition('PENDING', 'APPROVED').ok);
check('POS: approved->suspended', mpTransition('APPROVED', 'SUSPENDED').ok);
check('POS: suspended->approved', mpTransition('SUSPENDED', 'APPROVED').ok);
check('NEG: rejected->approved', !mpTransition('REJECTED', 'APPROVED').ok);
check('share 0..1 valid', isValidShare(0.15) && isValidShare(0) && isValidShare(1));
check('share >1 invalid', !isValidShare(1.5));
check('share negative invalid', !isValidShare(-0.1));
check('POS: valid shares', validateShares(0.1, 0.2).ok);
check('NEG: bad commission', !validateShares(2, 0.2).ok);
check('NEG: bad revenue share', !validateShares(0.1, 9).ok);
section('platform-compliance');
check('POS: dsr pending->in_progress', dsrCanTransition('PENDING', 'IN_PROGRESS').ok);
check('POS: dsr in_progress->completed', dsrCanTransition('IN_PROGRESS', 'COMPLETED').ok);
check('POS: dsr pending->rejected', dsrCanTransition('PENDING', 'REJECTED').ok);
check('NEG: dsr completed->in_progress', !dsrCanTransition('COMPLETED', 'IN_PROGRESS').ok);
check('NEG: dsr pending->completed (skip)', !dsrCanTransition('PENDING', 'COMPLETED').ok);
const consents = [
  { purpose: 'marketing', granted: true, recordedAt: 100 },
  { purpose: 'marketing', granted: false, recordedAt: 200 },
  { purpose: 'analytics', granted: true, recordedAt: 150 },
];
check('consent latest wins (revoked)', isConsentGranted(consents, 'marketing') === false);
check('consent granted analytics', isConsentGranted(consents, 'analytics') === true);
check('consent absent => false', isConsentGranted(consents, 'unknown') === false);
section('platform-reliability');
check('POS: job queued->running', jobCanTransition('QUEUED', 'RUNNING').ok);
check('POS: job running->success', jobCanTransition('RUNNING', 'SUCCESS').ok);
check('POS: job running->failed', jobCanTransition('RUNNING', 'FAILED').ok);
check('POS: job failed->queued (retry)', jobCanTransition('FAILED', 'QUEUED').ok);
check('NEG: job success->running', !jobCanTransition('SUCCESS', 'RUNNING').ok);
check('NEG: job queued->success (skip)', !jobCanTransition('QUEUED', 'SUCCESS').ok);
check('POS: deploy pending->deployed', deploymentCanTransition('PENDING', 'DEPLOYED').ok);
check('POS: deploy deployed->rolled_back', deploymentCanTransition('DEPLOYED', 'ROLLED_BACK').ok);
check('NEG: deploy rolled_back->deployed', !deploymentCanTransition('ROLLED_BACK', 'DEPLOYED').ok);
console.log('\n>>> Platform surface (Part 2) checks <<<');


// ===== PART 3: OPERATOR OPERATIONS =====
import { isExpired, daysToExpiry, isExpiringSoon, allValid } from '../src/common/logic/expiry.util';
import { isScheduledOn, validateDaysOfWeek, isSeasonActive, validateSeason, dayOfWeek } from '../src/common/logic/schedule.util';
import { rangesOverlap, leaveConflicts, rosterConflicts, attendanceStatus } from '../src/common/logic/crew-hr.util';
import { mileage, fuelCost, efficiencyVariancePct } from '../src/common/logic/fuel.util';
import { workOrderCanTransition } from '../src/common/logic/work-order.util';
const DAY = 86400000;
section('expiry');
const nowX = Date.UTC(2026, 5, 30);
check('expired in past', isExpired(nowX - DAY, nowX));
check('not expired in future', !isExpired(nowX + DAY, nowX));
check('days to expiry', daysToExpiry(nowX + 10 * DAY, nowX) === 10);
check('expiring soon within window', isExpiringSoon(nowX + 10 * DAY, nowX, 30));
check('not expiring soon beyond window', !isExpiringSoon(nowX + 60 * DAY, nowX, 30));
check('expired not "expiring soon"', !isExpiringSoon(nowX - DAY, nowX, 30));
check('allValid true when all future', allValid([nowX + DAY, nowX + 2 * DAY], nowX));
check('allValid false when one past', !allValid([nowX + DAY, nowX - DAY], nowX));
section('schedule');
const sunday = Date.UTC(2026, 5, 28); // 2026-06-28 is a Sunday
check('dayOfWeek sunday=0', dayOfWeek(sunday) === 0);
check('scheduled on matching day', isScheduledOn([0, 3], sunday));
check('not scheduled on other day', !isScheduledOn([1, 2], sunday));
check('POS: valid days', validateDaysOfWeek([0, 6]).ok);
check('NEG: empty days', !validateDaysOfWeek([]).ok);
check('NEG: out-of-range day', !validateDaysOfWeek([7]).ok);
check('season active inside window', isSeasonActive(nowX - DAY, nowX + DAY, nowX));
check('season inactive outside', !isSeasonActive(nowX + DAY, nowX + 2 * DAY, nowX));
check('POS: valid season', validateSeason(nowX, nowX + DAY).ok);
check('NEG: reversed season', !validateSeason(nowX + DAY, nowX).ok);
section('crew-hr');
check('ranges overlap', rangesOverlap({ start: 0, end: 10 }, { start: 5, end: 15 }));
check('ranges no overlap', !rangesOverlap({ start: 0, end: 5 }, { start: 5, end: 10 }));
check('leave conflicts', leaveConflicts([{ start: 0, end: 10 }], { start: 5, end: 8 }));
check('leave no conflict', !leaveConflicts([{ start: 0, end: 5 }], { start: 6, end: 8 }));
check('roster conflict', rosterConflicts([{ start: 0, end: 10 }], { start: 9, end: 12 }));
check('attendance present on time', attendanceStatus(1000, 1000) === 'PRESENT');
check('attendance late', attendanceStatus(1000, 1000 + 20 * 60000) === 'LATE');
check('attendance absent (no checkin)', attendanceStatus(1000, null) === 'ABSENT');
section('fuel');
check('mileage km/l', mileage(400, 100) === 4);
check('mileage zero litres safe', mileage(400, 0) === 0);
check('fuel cost', fuelCost(50, 100) === 5000);
check('efficiency variance positive', efficiencyVariancePct(5, 4) === 25);
check('efficiency variance negative', efficiencyVariancePct(3, 4) === -25);
section('work-order');
check('POS: open->in_progress', workOrderCanTransition('OPEN', 'IN_PROGRESS').ok);
check('POS: in_progress->closed', workOrderCanTransition('IN_PROGRESS', 'CLOSED').ok);
check('POS: open->cancelled', workOrderCanTransition('OPEN', 'CANCELLED').ok);
check('NEG: closed->open', !workOrderCanTransition('CLOSED', 'OPEN').ok);
check('NEG: open->closed (skip)', !workOrderCanTransition('OPEN', 'CLOSED').ok);
console.log('\n>>> Operator operations (Part 3) checks <<<');


// ===== PART 4: BOOKING & COMMERCE =====
import { categoryRank, isUpgrade as isSeatUpgrade, upgradeFareDifference, canOfferUpgrade } from '../src/common/logic/seat-upgrade.util';
import { transferCanTransition, canInitiateTransfer } from '../src/common/logic/transfer.util';
import { parseTicketToken, canBoard } from '../src/common/logic/boarding.util';
section('seat-upgrade');
check('rank order', categoryRank('SEATER') < categoryRank('SEMI_SLEEPER') && categoryRank('SEMI_SLEEPER') < categoryRank('SLEEPER'));
check('seater->sleeper is upgrade', isSeatUpgrade('SEATER', 'SLEEPER'));
check('sleeper->seater not upgrade', !isSeatUpgrade('SLEEPER', 'SEATER'));
check('fare diff positive', upgradeFareDifference(500, 800, false) === 300);
check('fare diff never negative', upgradeFareDifference(800, 500, false) === 0);
check('complimentary is free', upgradeFareDifference(500, 800, true) === 0);
check('POS: offer on confirmed upgrade', canOfferUpgrade('CONFIRMED', 'SEATER', 'SLEEPER').ok);
check('NEG: offer on cancelled', !canOfferUpgrade('CANCELLED', 'SEATER', 'SLEEPER').ok);
check('NEG: offer non-upgrade', !canOfferUpgrade('CONFIRMED', 'SLEEPER', 'SEATER').ok);
section('passenger-transfer');
check('POS: initiated->approved', transferCanTransition('INITIATED', 'APPROVED').ok);
check('POS: approved->executed', transferCanTransition('APPROVED', 'EXECUTED').ok);
check('NEG: initiated->executed (skip approve)', !transferCanTransition('INITIATED', 'EXECUTED').ok);
check('NEG: executed->approved', !transferCanTransition('EXECUTED', 'APPROVED').ok);
check('POS: can initiate confirmed diff trip', canInitiateTransfer('CONFIRMED', 't1', 't2').ok);
check('NEG: initiate same trip', !canInitiateTransfer('CONFIRMED', 't1', 't1').ok);
check('NEG: initiate cancelled booking', !canInitiateTransfer('CANCELLED', 't1', 't2').ok);
section('boarding');
check('parse valid ticket token', parseTicketToken('TICKET:ABCD1234') === 'ABCD1234');
check('parse bad token => null', parseTicketToken('HELLO') === null);
check('parse empty pnr => null', parseTicketToken('TICKET:') === null);
check('POS: can board confirmed unrecorded', canBoard('CONFIRMED', false).ok);
check('NEG: board already recorded', !canBoard('CONFIRMED', true).ok);
check('NEG: board cancelled', !canBoard('CANCELLED', false).ok);
console.log('\n>>> Booking & commerce (Part 4) checks <<<');


// ===== PART 5: FINANCE + SUPPORT + DISRUPTION + FORECASTING =====
import { ticketCanTransition } from '../src/common/logic/support-crm.util';
import { isBalanced, validateJournal, canPostToPeriod, totalDebits, totalCredits } from '../src/common/logic/accounting.util';
import { disruptionCanTransition, isMajorIncident } from '../src/common/logic/disruption.util';
import { demandLevel, recommendation } from '../src/common/logic/forecasting.util';
section('support-crm');
check('POS: open->assigned', ticketCanTransition('OPEN', 'ASSIGNED').ok);
check('POS: assigned->escalated', ticketCanTransition('ASSIGNED', 'ESCALATED').ok);
check('POS: resolved->open (reopen)', ticketCanTransition('RESOLVED', 'OPEN').ok);
check('POS: closed->open (reopen)', ticketCanTransition('CLOSED', 'OPEN').ok);
check('NEG: closed->resolved', !ticketCanTransition('CLOSED', 'RESOLVED').ok);
check('NEG: open->resolved (skip)', !ticketCanTransition('OPEN', 'RESOLVED').ok);
section('accounting');
const balanced = [{ account: 'Cash', debit: 100, credit: 0 }, { account: 'Sales', debit: 0, credit: 100 }];
const unbalanced = [{ account: 'Cash', debit: 100, credit: 0 }, { account: 'Sales', debit: 0, credit: 90 }];
check('totals debit', totalDebits(balanced) === 100);
check('totals credit', totalCredits(balanced) === 100);
check('balanced entry', isBalanced(balanced));
check('unbalanced entry', !isBalanced(unbalanced));
check('POS: validate balanced', validateJournal(balanced).ok);
check('NEG: validate unbalanced', !validateJournal(unbalanced).ok);
check('NEG: too few lines', !validateJournal([{ account: 'Cash', debit: 100, credit: 0 }]).ok);
check('NEG: line both debit+credit', !validateJournal([{ account: 'A', debit: 50, credit: 50 }, { account: 'B', debit: 0, credit: 0 }]).ok);
check('POS: can post open period', canPostToPeriod(false).ok);
check('NEG: cannot post closed period', !canPostToPeriod(true).ok);
section('disruption');
check('POS: open->mitigating', disruptionCanTransition('OPEN', 'MITIGATING').ok);
check('POS: mitigating->resolved', disruptionCanTransition('MITIGATING', 'RESOLVED').ok);
check('POS: resolved->closed', disruptionCanTransition('RESOLVED', 'CLOSED').ok);
check('NEG: closed->open', !disruptionCanTransition('CLOSED', 'OPEN').ok);
check('high is major incident', isMajorIncident('HIGH'));
check('critical is major incident', isMajorIncident('CRITICAL'));
check('low is not major', !isMajorIncident('LOW'));
section('forecasting');
check('high demand', demandLevel(0.9) === 'HIGH');
check('medium demand', demandLevel(0.6) === 'MEDIUM');
check('low demand', demandLevel(0.3) === 'LOW');
check('high => add bus + raise fare', recommendation('HIGH').addExtraBus && recommendation('HIGH').raiseFare);
check('low => lower fare', recommendation('LOW').lowerFare && !recommendation('LOW').addExtraBus);
check('medium => no action', !recommendation('MEDIUM').addExtraBus && !recommendation('MEDIUM').raiseFare && !recommendation('MEDIUM').lowerFare);
console.log('\n>>> Finance/Support/Disruption/Forecasting (Part 5) checks <<<');


// ===== CONNECTING-JOURNEY SEARCH =====
import { timeToMinutes, arrivalMinutes, layoverMinutes, isValidConnection } from '../src/common/logic/connection.util';
section('connection');
check('time to minutes', timeToMinutes('06:30') === 390);
check('arrival minutes with offset', arrivalMinutes('06:00', 150) === 510);
check('layover minutes', layoverMinutes(510, 560) === 50);
check('POS: valid layover', isValidConnection(510, 560, 20, 360).ok);
check('NEG: too tight', !isValidConnection(510, 520, 20, 360).ok);
check('NEG: too long', !isValidConnection(510, 1000, 20, 360).ok);
check('POS: exactly min layover', isValidConnection(510, 530, 20, 360).ok);
check('overnight arrival offset', arrivalMinutes('22:00', 300) === 1620);
console.log('\n>>> Connecting-journey checks <<<');


// ===== AUTH SECURITY + WORKFLOW + HUB =====
import { isStrongPassword, validatePassword, tokenExpired, refreshTokenUsable } from '../src/common/logic/auth-security.util';
import { classifyHubPosition, validateSpoke } from '../src/common/logic/hub.util';
section('auth-security');
check('strong password ok', isStrongPassword('abcd1234'));
check('short password weak', !isStrongPassword('ab12'));
check('no-digit weak', !isStrongPassword('abcdefgh'));
check('no-letter weak', !isStrongPassword('12345678'));
check('POS: validate strong', validatePassword('pass@123').ok);
check('NEG: validate weak', !validatePassword('short').ok);
const tNow = 1000000;
check('token expired past', tokenExpired(tNow - 1, tNow));
check('token not expired future', !tokenExpired(tNow + 10, tNow));
check('POS: refresh usable', refreshTokenUsable(tNow + 10, tNow, false).ok);
check('NEG: refresh revoked', !refreshTokenUsable(tNow + 10, tNow, true).ok);
check('NEG: refresh expired', !refreshTokenUsable(tNow - 10, tNow, false).ok);
section('hub');
check('hub at origin', classifyHubPosition(1, 1, 5) === 'ORIGIN');
check('hub at destination', classifyHubPosition(5, 1, 5) === 'DESTINATION');
check('hub intermediate', classifyHubPosition(3, 1, 5) === 'INTERMEDIATE');
check('POS: valid spoke', validateSpoke(['a', 'b', 'c'], 'b').ok);
check('NEG: spoke missing hub', !validateSpoke(['a', 'b', 'c'], 'z').ok);
console.log('\n>>> Auth/Workflow/Hub checks <<<');


// ===== RAZORPAY SIGNATURE =====
import { expectedSignature, verifyRazorpaySignature, toPaise } from '../src/common/logic/razorpay.util';
section('razorpay');
const rzpSig = expectedSignature('order_123', 'pay_456', 'secret');
check('signature is deterministic', rzpSig === expectedSignature('order_123', 'pay_456', 'secret'));
check('POS: valid signature verifies', verifyRazorpaySignature('order_123', 'pay_456', rzpSig, 'secret'));
check('NEG: wrong secret fails', !verifyRazorpaySignature('order_123', 'pay_456', rzpSig, 'wrong'));
check('NEG: tampered payment id fails', !verifyRazorpaySignature('order_123', 'pay_999', rzpSig, 'secret'));
check('NEG: empty fields fail', !verifyRazorpaySignature('', 'pay_456', rzpSig, 'secret'));
check('paise conversion', toPaise(10) === 1000);
check('paise below minimum -> 0', toPaise(0.5) === 0);
console.log('\n>>> Razorpay checks <<<');


// ===== DYNAMIC FARE =====
import { dynamicFareMultiplier, applyDynamicFare } from '../src/common/logic/dynamic-fare.util';
section('dynamic-fare');
check('high occupancy surges', dynamicFareMultiplier({ occupancyPct: 0.95, daysToDeparture: 10 }) > 1);
check('low occupancy discounts', dynamicFareMultiplier({ occupancyPct: 0.1, daysToDeparture: 30 }) < 1);
check('same-day adds urgency', dynamicFareMultiplier({ occupancyPct: 0.5, daysToDeparture: 0 }) > dynamicFareMultiplier({ occupancyPct: 0.5, daysToDeparture: 10 }));
check('clamped at max 2.0', dynamicFareMultiplier({ occupancyPct: 1, daysToDeparture: 0, baseMultiplier: 2, hour: 8 }) <= 2.0);
check('clamped at min 0.8', dynamicFareMultiplier({ occupancyPct: 0, daysToDeparture: 30, baseMultiplier: 0.8 }) >= 0.8);
check('applyDynamicFare strips base', applyDynamicFare(200, 2, 1) === 100);
check('applyDynamicFare same when equal', applyDynamicFare(150, 1, 1) === 150);
console.log('\n>>> Dynamic fare checks <<<');


// ===== SLA SCORE =====
import { computeSlaScore, slaGrade } from '../src/common/logic/sla-score.util';
section('sla-score');
const perfect = computeSlaScore({ avgRating: 5, tripCancellationRate: 0, bookingCancellationRate: 0, disruptionRate: 0, majorIncidents: 0 });
check('perfect operator ~100', perfect >= 95);
check('perfect grade EXCELLENT', slaGrade(perfect) === 'EXCELLENT');
const bad = computeSlaScore({ avgRating: 1, tripCancellationRate: 0.8, bookingCancellationRate: 0.7, disruptionRate: 0.9, majorIncidents: 5 });
check('bad operator low score', bad < 40);
check('bad grade NEEDS_IMPROVEMENT', slaGrade(bad) === 'NEEDS_IMPROVEMENT');
check('major incidents penalize', computeSlaScore({ avgRating: 5, tripCancellationRate: 0, bookingCancellationRate: 0, disruptionRate: 0, majorIncidents: 3 }) < perfect);
check('score clamped 0..100', computeSlaScore({ avgRating: 5, tripCancellationRate: 0, bookingCancellationRate: 0, disruptionRate: 0, majorIncidents: 100 }) >= 0);
console.log('\n>>> SLA score checks <<<');


// ===== COUPON =====
import { computeCouponDiscount, validateCoupon } from '../src/common/logic/coupon.util';
section('coupon');
check('percent discount', computeCouponDiscount(1000, 'PERCENT', 10) === 100);
check('flat discount', computeCouponDiscount(1000, 'FLAT', 150) === 150);
check('percent capped by maxDiscount', computeCouponDiscount(1000, 'PERCENT', 50, 200) === 200);
check('discount never exceeds fare', computeCouponDiscount(100, 'FLAT', 500) === 100);
const base = { active: true, usedCount: 0, userUsedCount: 0, type: 'PERCENT' as const, value: 10 };
check('POS: valid coupon', validateCoupon({ ...base }, 500, 1000).ok);
check('NEG: inactive', !validateCoupon({ ...base, active: false }, 500, 1000).ok);
check('NEG: expired', !validateCoupon({ ...base, validToMs: 500 }, 500, 1000).ok);
check('NEG: below min fare', !validateCoupon({ ...base, minFare: 600 }, 500, 1000).ok);
check('NEG: usage exhausted', !validateCoupon({ ...base, usageLimit: 5, usedCount: 5 }, 500, 1000).ok);
check('NEG: per-user limit', !validateCoupon({ ...base, perUserLimit: 1, userUsedCount: 1 }, 500, 1000).ok);
console.log('\n>>> Coupon checks <<<');


// ===== WALLET =====
import { walletBalance, canDebit } from '../src/common/logic/wallet.util';
section('wallet');
check('balance credit-debit', walletBalance([{ type: 'CREDIT', amount: 900 }, { type: 'DEBIT', amount: 200 }]) === 700);
check('empty balance 0', walletBalance([]) === 0);
check('POS: canDebit within', canDebit(700, 500));
check('NEG: canDebit over', !canDebit(700, 800));
check('NEG: canDebit zero', !canDebit(700, 0));
check('NEG: canDebit negative', !canDebit(700, -5));
console.log('\n>>> Wallet checks <<<');


// ===== LOYALTY =====
import { referralRewards, pointsForBooking, pointsValue, canRedeemReferral } from '../src/common/logic/loyalty.util';
section('loyalty');
const rw = referralRewards({ referrerReward: 50, refereeReward: 25 });
check('referral rewards', rw.referrer === 50 && rw.referee === 25);
check('points for booking floor', pointsForBooking(525, 0.1) === 52);
check('no points for zero amount', pointsForBooking(0, 0.1) === 0);
check('points value', pointsValue(100, 0.25) === 25);
check('POS: referral by other user', canRedeemReferral('u1', 'u2').ok);
check('NEG: self referral blocked', !canRedeemReferral('u1', 'u1').ok);
console.log('\n>>> Loyalty checks <<<');


// ===== NOTIFICATION POLICY =====
import { resolveAllowed, isMandatory } from '../src/common/logic/notification-catalog';
section('notification-policy');
check('mandatory always sent (OTP)', resolveAllowed({ key: 'OTP_LOGIN', planEnabled: false, operatorEnabled: false }) === true);
check('mandatory flag', isMandatory('PAYMENT_SUCCESS') === true);
check('optional default ON', resolveAllowed({ key: 'TRIP_REMINDER' }) === true);
check('plan OFF suppresses', resolveAllowed({ key: 'TRIP_REMINDER', planEnabled: false }) === false);
check('operator OFF suppresses', resolveAllowed({ key: 'SEAT_UPGRADE_OFFER', operatorEnabled: false }) === false);
check('both ON sends', resolveAllowed({ key: 'WALLET_CREDITED', planEnabled: true, operatorEnabled: true }) === true);
check('unknown key fail-open', resolveAllowed({ key: 'SOME_NEW_KEY', planEnabled: false }) === true);
console.log('\n>>> Notification policy checks <<<');


// ===== Gender-based seat validation (requirements 7-10) =====
check('ladies-reserved: male blocked', validateSeatGenderAssignment([{ seatNumber: 'A1', gender: 'MALE' }], ['A1'], {}, []).ok === false);
check('ladies-reserved: female allowed', validateSeatGenderAssignment([{ seatNumber: 'A1', gender: 'FEMALE' }], ['A1'], {}, []).ok === true);
check('ladies-reserved: case-insensitive', validateSeatGenderAssignment([{ seatNumber: 'a1', gender: 'MALE' }], ['A1'], {}, []).ok === false);
check('adjacency: male blocked next to occupied female', validateSeatGenderAssignment([{ seatNumber: 'L4', gender: 'MALE' }], [], { L4: 'L3', L3: 'L4' }, [{ seatNumber: 'L3', gender: 'FEMALE' }]).ok === false);
check('adjacency: female allowed next to occupied female', validateSeatGenderAssignment([{ seatNumber: 'L4', gender: 'FEMALE' }], [], { L4: 'L3', L3: 'L4' }, [{ seatNumber: 'L3', gender: 'FEMALE' }]).ok === true);
check('adjacency: male allowed next to occupied male', validateSeatGenderAssignment([{ seatNumber: 'L4', gender: 'MALE' }], [], { L4: 'L3', L3: 'L4' }, [{ seatNumber: 'L3', gender: 'MALE' }]).ok === true);
check('adjacency: no pair configured allowed', validateSeatGenderAssignment([{ seatNumber: 'X9', gender: 'MALE' }], [], {}, [{ seatNumber: 'X8', gender: 'FEMALE' }]).ok === true);
check('within-booking male blocked when paired female together', validateSeatGenderAssignment([{ seatNumber: 'L3', gender: 'FEMALE' }, { seatNumber: 'L4', gender: 'MALE' }], [], { L3: 'L4', L4: 'L3' }, []).ok === false);
check('mixed-gender non-adjacent allowed', validateSeatGenderAssignment([{ seatNumber: 'C1', gender: 'FEMALE' }, { seatNumber: 'D5', gender: 'MALE' }], [], {}, []).ok === true);
check('empty assignment valid', validateSeatGenderAssignment([], ['A1'], { L3: 'L4' }, []).ok === true);
check('female-female adjacent allowed', validateSeatGenderAssignment([{ seatNumber: 'L3', gender: 'FEMALE' }, { seatNumber: 'L4', gender: 'FEMALE' }], [], { L3: 'L4', L4: 'L3' }, []).ok === true);
check('ladies-reserved error code', validateSeatGenderAssignment([{ seatNumber: 'A1', gender: 'MALE' }], ['A1'], {}, []).code === 'LADIES_RESERVED_SEAT');
check('adjacency error code', validateSeatGenderAssignment([{ seatNumber: 'L4', gender: 'MALE' }], [], { L4: 'L3' }, [{ seatNumber: 'L3', gender: 'FEMALE' }]).code === 'ADJACENT_FEMALE_SEAT');
console.log('\\n>>> Gender seat validation checks <<<');

console.log('\n========== EXTENDED TOTAL ==========');
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
if (failures.length) console.log('FAILURES:\n - ' + failures.slice(0, 20).join('\n - '));
console.log('===================================');
process.exit(failed > 0 ? 1 : 0);
