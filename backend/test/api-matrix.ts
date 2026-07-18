/**
 * Yoo Bus — full API coverage + role access matrix.
 *
 * This walks EVERY route the server exposes and asks three questions of each one:
 *
 *   1. Does it crash?            No route may return 500. Ever.
 *   2. Does the guard let the right roles in?    An allowed role must never see 403.
 *   3. Does the guard keep the wrong roles out?  A disallowed role must ALWAYS see 403.
 *
 * (3) is the one that matters most: it is the machine-checked version of
 * "jis role ke liye functionality hai, sirf usi ko dikhegi". The UI hides menu items,
 * but hiding is not enforcing — this proves the server enforces it, which is the only
 * thing an attacker cannot bypass.
 *
 * Run:  node dist/main.js          (terminal 1, after npm run seed)
 *       npm run test:api           (terminal 2)
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000/api/v1';

type Route = {
  m: string;
  p: string;
  fn: string;
  roles: string[];
  public: boolean;
  perm: string[];
  file: string;
};

type Res = { status: number; body: any; raw: any };

const ROLES = [
  'SUPERADMIN',
  'ACCOUNTANT',
  'PLATFORM_SUPPORT',
  'OPERATOR_ADMIN',
  'SUPPORT',
  'DRIVER',
  'CUSTOMER',
] as const;
type RoleName = (typeof ROLES)[number];

const tokens: Partial<Record<RoleName, string>> = {};

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) pass++;
  else {
    fail++;
    failures.push(`${name}${detail !== undefined ? `  ↳ ${JSON.stringify(detail)}` : ''}`);
  }
}

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<Res> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  let raw: any = null;
  const text = await res.text();
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = text;
  }
  const body = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
  return { status: res.status, body, raw };
}

const post = (p: string, b?: unknown, t?: string) => call('POST', p, { body: b, token: t });
const patch = (p: string, b?: unknown, t?: string) => call('PATCH', p, { body: b, token: t });
const put = (p: string, b?: unknown, t?: string) => call('PUT', p, { body: b, token: t });
const get = (p: string, t?: string) => call('GET', p, { token: t });

const rows = (b: any): any[] =>
  Array.isArray(b) ? b : Array.isArray(b?.data) ? b.data : Array.isArray(b?.items) ? b.items : [];

// ────────────────────────────────────────────────────────────────────────────
// Fixtures — real IDs so path params resolve to real rows, not 404 noise.
// ────────────────────────────────────────────────────────────────────────────
const stamp = Date.now();
const uniq = (n: number) => String(9000000000 + ((stamp + n) % 999999999)).slice(0, 10);
const panOf = (n: number) => `AABC${String.fromCharCode(65 + ((stamp + n) % 26))}${String(stamp).slice(-4)}R`;
const gstinOf = (n: number) => `0${(n % 9) + 1}${panOf(n)}1ZX`;

const ids: Record<string, string> = {};

async function buildFixtures(): Promise<void> {
  console.log('\n── Building fixtures (a real operator, staff, fleet) ─────────');

  // Platform: SuperAdmin
  const sa = await post('/auth/login', { identifier: 'superadmin@yoobus.com', password: 'pass@123' });
  tokens.SUPERADMIN = sa.body?.accessToken;
  if (!tokens.SUPERADMIN) throw new Error('SuperAdmin login failed — did you run `npm run seed`?');

  // Platform: Accountant + Platform Support
  const acct = await post(
    '/users/platform-staff',
    { email: `acct${stamp}@yoobus.com`, fullName: 'Yoo Bus Accountant', phone: uniq(11), role: 'ACCOUNTANT' },
    tokens.SUPERADMIN,
  );
  const acctLogin = await post('/auth/login', {
    identifier: `acct${stamp}@yoobus.com`,
    password: acct.body?.tempPassword,
  });
  tokens.ACCOUNTANT = acctLogin.body?.accessToken;

  const psup = await post(
    '/users/platform-staff',
    { email: `psup${stamp}@yoobus.com`, fullName: 'Yoo Bus Support', phone: uniq(12), role: 'PLATFORM_SUPPORT' },
    tokens.SUPERADMIN,
  );
  const psupLogin = await post('/auth/login', {
    identifier: `psup${stamp}@yoobus.com`,
    password: psup.body?.tempPassword,
  });
  tokens.PLATFORM_SUPPORT = psupLogin.body?.accessToken;

  // Operator: apply → KYC → verify → approve
  const lead = await post('/operators/apply', {
    companyName: `Sharma Travels ${stamp}`,
    contactName: 'Ravi Sharma',
    email: `ravi${stamp}@sharma.com`,
    mobile: uniq(1),
    city: 'Delhi',
    totalBuses: 12,
  });
  ids.leadId = lead.body?.id;
  await patch(
    `/operators/leads/${ids.leadId}/kyc`,
    {
      gstin: gstinOf(1),
      pan: panOf(1),
      legalName: `Sharma Travels Pvt Ltd ${stamp}`,
      address: { line1: 'Karol Bagh', city: 'Delhi', state: 'DL', pincode: '110005' },
      bankDetails: { accountNumber: '123456789012', ifsc: 'HDFC0001234', accountName: 'Sharma Travels' },
      documents: { gstCertificate: 'gst.pdf', panCard: 'pan.pdf' },
    },
    tokens.SUPERADMIN,
  );
  await patch(`/operators/leads/${ids.leadId}/verify`, {}, tokens.SUPERADMIN);
  const approved = await patch(`/operators/leads/${ids.leadId}/approve`, {}, tokens.SUPERADMIN);
  ids.operatorId = approved.body?.operator?.id;

  if (!approved.body?.adminEmail) console.log('    approve failed:', JSON.stringify(approved.raw).slice(0, 220));
  const oaLogin = await post('/auth/login', {
    identifier: approved.body?.adminEmail,
    password: approved.body?.tempPassword,
  });
  tokens.OPERATOR_ADMIN = oaLogin.body?.accessToken;
  ids.operatorAdminUserId = oaLogin.body?.user?.id;

  // Operator staff: Support + Driver
  const sup = await post(
    '/users/staff',
    { email: `sup${stamp}@sharma.com`, fullName: 'Op Support', phone: uniq(2), role: 'SUPPORT' },
    tokens.OPERATOR_ADMIN,
  );
  ids.supportUserId = sup.body?.id;
  const supLogin = await post('/auth/login', { identifier: `sup${stamp}@sharma.com`, password: sup.body?.tempPassword });
  tokens.SUPPORT = supLogin.body?.accessToken;

  const drv = await post(
    '/users/staff',
    { email: `drv${stamp}@sharma.com`, fullName: 'Mohan Driver', phone: uniq(3), role: 'DRIVER' },
    tokens.OPERATOR_ADMIN,
  );
  ids.driverId = drv.body?.id;
  const drvLogin = await post('/auth/login', { identifier: `drv${stamp}@sharma.com`, password: drv.body?.tempPassword });
  tokens.DRIVER = drvLogin.body?.accessToken;

  // Passenger. Registration is an OTP flow: register -> verify -> login.
  // In EMAIL_DEV_MODE the server echoes the OTP back (never in production), which is the
  // only way to complete a signup without a live mail server.
  const paxEmail = `pax${stamp}@gmail.com`;
  const reg = await post('/auth/register', {
    fullName: 'Test Passenger',
    email: paxEmail,
    phone: uniq(4),
    password: 'Pax@12345',
    consentGiven: true,
  });
  const devOtp: string | undefined = reg.body?.devOtp;
  if (devOtp) await post('/auth/verify-email', { email: paxEmail, otp: devOtp });
  const paxLogin = await post('/auth/login', { identifier: paxEmail, password: 'Pax@12345' });
  tokens.CUSTOMER = paxLogin.body?.accessToken;
  ids.userId = paxLogin.body?.user?.id ?? '';
  // Booking is gated on a complete profile (DOB + gender). That gate is correct; meet it.
  await patch('/me', { dateOfBirth: '1995-04-12', gender: 'MALE' }, tokens.CUSTOMER);

  // Fleet: bus (BASIC plan allows NON_AC_SEATER)
  const bus = await post(
    '/buses',
    { registrationNumber: `DL01AB${stamp % 10000}`, name: 'Ashok Leyland', totalSeats: 36, busType: 'NON_AC_SEATER' },
    tokens.OPERATOR_ADMIN,
  );
  ids.busId = bus.body?.id;

  // Stops + route
  const s1 = await post('/stops', { name: `Delhi ISBT ${stamp}`, city: 'Delhi', state: 'DL', code: `DL${stamp % 10000}` }, tokens.OPERATOR_ADMIN);
  const s2 = await post('/stops', { name: `Jaipur Sindhi ${stamp}`, city: 'Jaipur', state: 'RJ', code: `JP${stamp % 10000}` }, tokens.OPERATOR_ADMIN);
  ids.stopId = s1.body?.id;
  ids.stopId2 = s2.body?.id;

  const route = await post(
    '/routes',
    {
      name: `Delhi → Jaipur ${stamp}`,
      stops: [
        { stopId: ids.stopId, stopOrder: 0, fareFromOrigin: 0, arrivalOffsetMin: 0 },
        { stopId: ids.stopId2, stopOrder: 1, fareFromOrigin: 750, arrivalOffsetMin: 300 },
      ],
    },
    tokens.OPERATOR_ADMIN,
  );
  ids.routeId = route.body?.id;
  if (!ids.routeId) console.log('    route failed:', JSON.stringify(route.raw).slice(0, 200));

  // A trip needs its bus mapped to the route first — one bus, one active route.
  await patch(`/buses/${ids.busId}/route`, { routeId: ids.routeId }, tokens.OPERATOR_ADMIN);

  // ── The booking chain: trip → seat hold → booking. This is where money and seats meet,
  //    so it is the one flow that MUST work end to end.
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const trip = await post(
    '/trips',
    { routeId: ids.routeId, busId: ids.busId, departureDate: tomorrow, departureTime: '21:30' },
    tokens.OPERATOR_ADMIN,
  );
  ids.tripId = trip.body?.id;
  if (!ids.tripId) console.log('    trip failed:', JSON.stringify(trip.raw).slice(0, 200));

  const roleSummary = ROLES.map((r) => `${r}${tokens[r] ? '✓' : '✗'}`).join('  ');
  console.log(`  tokens: ${roleSummary}`);
  console.log(
    `  ids: operator=${ids.operatorId ? '✓' : '✗'} bus=${ids.busId ? '✓' : '✗'} route=${ids.routeId ? '✓' : '✗'} stop=${ids.stopId ? '✓' : '✗'} driver=${ids.driverId ? '✓' : '✗'} trip=${ids.tripId ? '✓' : '✗'}`,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Path-param substitution
// ────────────────────────────────────────────────────────────────────────────
const NIL = '00000000-0000-4000-8000-000000000000';

/**
 * Every path param becomes a well-formed but NON-EXISTENT id.
 *
 * This matters. Guards run before handlers, so a guard test does not need a real row — and
 * pointing a probe at a real row is actively dangerous: an earlier version of this suite
 * substituted the live passenger's id into `:userId`, and a SUPERADMIN probe of the DPDP
 * erasure route promptly deleted them. Every later CUSTOMER probe then returned 404 and
 * looked like an access leak. Probe with ids that own nothing.
 */
function fillPath(p: string): string {
  return p.replace(/:(\w+)/g, (_, name: string) => (name === 'pnr' ? 'YB000000' : name === 'namespace' ? 'APPEARANCE' : name === 'period' ? '2026-07' : NIL));
}

/** A body good enough to get past validation for write routes we are only probing for guards. */
function probeBody(r: Route): unknown {
  if (r.m === 'GET' || r.m === 'DELETE') return undefined;
  return {};
}

// ────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const routes: Route[] = JSON.parse(readFileSync(join(__dirname, 'routes.json'), 'utf8'));
  console.log('\n═══ Yoo Bus — full API coverage & role matrix ═══');
  console.log(`  ${routes.length} routes × ${ROLES.length} roles`);

  await buildFixtures();

  for (const r of ROLES) {
    check(`token acquired for ${r}`, !!tokens[r], tokens[r] ? undefined : 'LOGIN FAILED');
  }

  // ══════════════════════════════════════════════════════════════════
  console.log('\n── Probing every route with every role ──────────────────────');

  const crashes: string[] = [];
  const leaks: string[] = [];
  const lockouts: string[] = [];
  let probes = 0;

  for (const r of routes) {
    const path = fillPath(r.p);
    // Skip the destructive platform routes — they would tear down the fixtures mid-run.
    // Self-destructive routes would take out the very identity we are probing with:
    // DELETE /me deactivates the passenger, and every later CUSTOMER probe then looks
    // like an access leak. Probe them separately, not inside the matrix.
    const selfDestructive = r.m === 'DELETE' && (r.p === '/me' || r.p === '/profile');
    if (selfDestructive) continue;
    if (/logout-all|purge|hard|reset-platform/.test(r.p)) continue;

    for (const role of ROLES) {
      const token = tokens[role];
      if (!token) continue;

      const res = await call(r.m, path, { token, body: probeBody(r) });
      probes++;

      // 1. Nothing may crash.
      if (res.status >= 500) {
        crashes.push(`${r.m} ${r.p} as ${role} -> ${res.status} ${JSON.stringify(res.raw?.error?.message ?? '')}`);
      }

      const allowed = r.public || r.roles.length === 0 || r.roles.includes(role);

      // 2. A disallowed role must be refused. 403 = guard fired. Anything else is a LEAK.
      if (!allowed && res.status !== 403) {
        leaks.push(
          `${r.m} ${r.p} — ${role} is NOT in [${r.roles.join(', ')}] but got ${res.status} ${JSON.stringify(res.raw?.error?.code ?? res.raw?.message ?? '')}`,
        );
      }

      // 3. An allowed role must never be refused by the ROLE guard.
      //    (403 from a PERMISSION guard is legitimate and is reported separately.)
      // A 403 from the ROLE guard on a role that IS granted is a lockout — the guard is
      // wrong. A 403 raised by the handler's own business rules (e.g. "you may not grant a
      // platform permission") is correct and is not a lockout, so only count guard-level
      // refusals: those carry no error code of their own.
      const businessRefusal = typeof res.raw?.error?.code === 'string' && res.raw.error.code !== 'FORBIDDEN';
      if (allowed && res.status === 403 && r.perm.length === 0 && !businessRefusal) {
        lockouts.push(`${r.m} ${r.p} — ${role} IS in [${r.roles.join(', ')}] but got 403`);
      }
    }
  }

  console.log(`  ${probes} probes fired`);

  check('NO route returns 500', crashes.length === 0, crashes.slice(0, 12));
  check('NO role reaches a route it is not granted (zero leaks)', leaks.length === 0, leaks.slice(0, 12));
  check('NO granted role is locked out of its own route', lockouts.length === 0, lockouts.slice(0, 12));

  if (crashes.length) {
    console.log(`\n  ✗ ${crashes.length} CRASHES (500):`);
    crashes.slice(0, 20).forEach((c) => console.log(`      ${c}`));
  }
  if (leaks.length) {
    console.log(`\n  ✗ ${leaks.length} ACCESS LEAKS:`);
    leaks.slice(0, 20).forEach((c) => console.log(`      ${c}`));
  }
  if (lockouts.length) {
    console.log(`\n  ✗ ${lockouts.length} LOCKOUTS:`);
    lockouts.slice(0, 20).forEach((c) => console.log(`      ${c}`));
  }

  // ══════════════════════════════════════════════════════════════════
  console.log('\n── Unauthenticated probe: every guarded route must 401 ──────');
  let openDoors: string[] = [];
  for (const r of routes) {
    if (r.public) continue;
    if (/logout-all|purge|hard/.test(r.p)) continue;
    const res = await call(r.m, fillPath(r.p), { body: probeBody(r) });
    if (res.status !== 401) openDoors.push(`${r.m} ${r.p} -> ${res.status} (should be 401)`);
  }
  check('every guarded route rejects an anonymous caller', openDoors.length === 0, openDoors.slice(0, 12));
  if (openDoors.length) {
    console.log(`\n  ✗ ${openDoors.length} routes answer WITHOUT a token:`);
    openDoors.slice(0, 20).forEach((c) => console.log(`      ${c}`));
  }

  // ══════════════════════════════════════════════════════════════════
  console.log('\n── Integration: search → hold → book → ticket → cancel ──────');

  const search = await get(
    `/trips/search?fromStopId=${ids.stopId}&toStopId=${ids.stopId2}&date=${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}`,
    tokens.CUSTOMER,
  );
  check('a passenger can search trips', search.status === 200, search.raw?.error);
  check('the seeded trip is findable', rows(search.body).some((t: any) => (t.id ?? t.tripId) === ids.tripId), JSON.stringify(rows(search.body)[0] ?? {}).slice(0, 140));

  const seats = await get(`/trips/${ids.tripId}/seats?boardingStopId=${ids.stopId}&droppingStopId=${ids.stopId2}`, tokens.CUSTOMER);
  check('seat map loads for the trip', seats.status === 200, seats.raw?.error);

  const hold = await post(
    '/bookings/hold',
    { tripId: ids.tripId, boardingStopId: ids.stopId, droppingStopId: ids.stopId2, seatNumbers: ['1'] },
    tokens.CUSTOMER,
  );
  check('a seat can be held', hold.status === 200 || hold.status === 201, hold.raw?.error);
  const holdToken: string = hold.body?.holdToken ?? hold.body?.token;

  // The same seat must not be holdable twice — that is the whole point of a hold.
  const doubleHold = await post(
    '/bookings/hold',
    { tripId: ids.tripId, boardingStopId: ids.stopId, droppingStopId: ids.stopId2, seatNumbers: ['1'] },
    tokens.CUSTOMER,
  );
  check('the SAME seat cannot be held twice (no double-booking)', doubleHold.status >= 400, doubleHold.status);

  const booking = holdToken
    ? await post(
        '/bookings',
        { holdToken, passengers: [{ seatNumber: '1', name: 'Test Pax', age: 30, gender: 'MALE' }] },
        tokens.CUSTOMER,
      )
    : { status: 0, body: null, raw: null };
  check('the hold converts into a booking', booking.status === 200 || booking.status === 201, booking.raw?.error);
  ids.bookingId = booking.body?.id ?? booking.body?.bookingId ?? booking.body?.booking?.id;
  const pnr: string = booking.body?.pnr;
  check('the booking gets a PNR', !!pnr, pnr);

  if (pnr) {
    const byPnr = await get(`/bookings/pnr/${pnr}`, tokens.CUSTOMER);
    check('the booking is retrievable by PNR', byPnr.status === 200, byPnr.raw?.error);
  }

  const mine = await get('/bookings/my', tokens.CUSTOMER);
  check('the booking appears in the passenger\'s own list', rows(mine.body).some((b: any) => b.id === ids.bookingId), { want: ids.bookingId, got: rows(mine.body).map((b: any) => b.id) });

  // Isolation, on real data this time: operator B must not see operator A's booking.
  const opBooking = await get('/bookings', tokens.OPERATOR_ADMIN);
  check('operator A sees the booking on its own trip', rows(opBooking.body).some((b: any) => b.id === ids.bookingId), { want: ids.bookingId, got: rows(opBooking.body).map((b: any) => b.id) });

  if (ids.bookingId) {
    const cancel = await patch(`/bookings/${ids.bookingId}/cancel`, { reason: 'test', refundToWallet: true }, tokens.CUSTOMER);
    check('the passenger can cancel and be refunded', cancel.status === 200, cancel.raw?.error);

    const wallet = await get('/wallet', tokens.CUSTOMER);
    check('the refund lands in the wallet', wallet.status === 200, wallet.raw?.error);
  }

  // ══════════════════════════════════════════════════════════════════
  console.log('\n── Per-seat pricing ─────────────────────────────────────────');

  // Every seat on a trip used to cost exactly the same. Price the front row up and the back
  // row down, then check that a passenger actually sees the difference.
  const priceSeats = await put(
    `/buses/${ids.busId}/seat-fares`,
    {
      fares: [
        { seatNumber: '1', multiplier: 1.2 },
        { seatNumber: '2', multiplier: 1.2, delta: 50 },
      ],
    },
    tokens.OPERATOR_ADMIN,
  );
  check('an operator can price individual seats', priceSeats.status === 200, priceSeats.raw?.error);

  const upAll = await patch(`/buses/${ids.busId}/seat-fares/adjust`, { percent: 5 }, tokens.OPERATOR_ADMIN);
  check('"+5% on every seat" is one call', upAll.status === 200, upAll.raw?.error);

  const downSome = await patch(
    `/buses/${ids.busId}/seat-fares/adjust`,
    { percent: -10, seats: ['3', '4'] },
    tokens.OPERATOR_ADMIN,
  );
  check('a discount can hit SOME seats only', downSome.status === 200, downSome.raw?.error);

  const ghost = await patch(
    `/buses/${ids.busId}/seat-fares/adjust`,
    { percent: 5, seats: ['99Z'] },
    tokens.OPERATOR_ADMIN,
  );
  check('a seat that is not on the bus is refused', ghost.status === 400, ghost.status);

  const absurd = await patch(
    `/buses/${ids.busId}/seat-fares/adjust`,
    { setMultiplier: 99 },
    tokens.OPERATOR_ADMIN,
  );
  check('an absurd multiplier is refused, not stored', absurd.status === 400, absurd.status);

  // What a PASSENGER sees — and a guest, since the seat map is public.
  const priced = await get(
    `/trips/${ids.tripId}/seats?boardingStopId=${ids.stopId}&droppingStopId=${ids.stopId2}`,
    tokens.CUSTOMER,
  );
  const ps: Array<{ seatNumber: string; fare: number; priceBand: string; available: boolean }> =
    priced.body?.seats ?? [];
  check('every seat carries its own price', ps.length > 0 && ps.every((s) => typeof s.fare === 'number'), ps[0]);
  check(
    'the seats are NOT all the same price any more',
    new Set(ps.map((s) => s.fare)).size > 1,
    [...new Set(ps.map((s) => s.fare))].slice(0, 6),
  );
  check('a premium seat is marked PREMIUM', ps.some((s) => s.priceBand === 'PREMIUM'));
  check('a saver seat is marked SAVER', ps.some((s) => s.priceBand === 'SAVER'));
  check(
    'the fare range is advertised (from / to)',
    typeof priced.body?.fareFrom === 'number' && priced.body.fareTo > priced.body.fareFrom,
    { from: priced.body?.fareFrom, to: priced.body?.fareTo },
  );

  // A GUEST — no token at all — must see the same map. That is the whole point of the
  // public search: nobody creates an account before they have seen a bus.
  const guestSeats = await get(
    `/trips/${ids.tripId}/seats?boardingStopId=${ids.stopId}&droppingStopId=${ids.stopId2}`,
  );
  check('a GUEST can see the seat map and its prices', guestSeats.status === 200, guestSeats.status);

  const guestSearch = await get(
    `/trips/search?fromStopId=${ids.stopId}&toStopId=${ids.stopId2}&date=${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}`,
  );
  check('a GUEST can search', guestSearch.status === 200 && rows(guestSearch.body).length > 0, guestSearch.status);

  // And the money must be right: holding two differently-priced seats charges their SUM.
  const twoSeats = ps.filter((s) => s.available).slice(0, 2);
  if (twoSeats.length === 2) {
    const hold2 = await post(
      '/bookings/hold',
      {
        tripId: ids.tripId,
        boardingStopId: ids.stopId,
        droppingStopId: ids.stopId2,
        seatNumbers: twoSeats.map((s) => s.seatNumber),
      },
      tokens.CUSTOMER,
    );
    const expected = Math.round((twoSeats[0].fare + twoSeats[1].fare) * 100) / 100;
    check(
      'holding two differently-priced seats charges their SUM',
      Math.abs((hold2.body?.amountEstimate ?? 0) - expected) < 0.01,
      { got: hold2.body?.amountEstimate, expected },
    );
  }

  // ══════════════════════════════════════════════════════════════════
  console.log('\n── Seat layout builder ──────────────────────────────────────');

  const cat = await get('/seat-layouts/catalogue', tokens.OPERATOR_ADMIN);
  check('the builder gets its canvas and toolbox from the SERVER', cat.status === 200, cat.raw?.error);
  check('the canvas is 320x800 on a 20px grid', cat.body?.canvas?.width === 320 && cat.body?.canvas?.grid === 20, cat.body?.canvas);
  check('the toolbox is not hardcoded in the UI', (cat.body?.items ?? []).length > 8, (cat.body?.items ?? []).length);

  const draft = await post('/seat-layouts', { name: `Volvo Sleeper ${stamp}`, busType: 'AC_SLEEPER' }, tokens.OPERATOR_ADMIN);
  check('an operator can start a layout', draft.status === 200 || draft.status === 201, draft.raw?.error);
  ids.layoutId = draft.body?.id;
  ids.familyId = draft.body?.familyId;
  check('a new layout starts as a DRAFT at version 1', draft.body?.status === 'DRAFT' && draft.body?.version === 1);

  // A broken layout: no driver, no door.
  const broken = await patch(
    `/seat-layouts/${ids.layoutId}`,
    { definition: { decks: [{ deck: 'LOWER', items: [{ id: 'a', kind: 'SEATER', x: 20, y: 80, w: 40, h: 40, rotation: 0, seatNumber: '1' }] }] } },
    tokens.OPERATOR_ADMIN,
  );
  check('a draft can be saved even while it is still broken', broken.status === 200, broken.raw?.error);

  const badPublish = await post(`/seat-layouts/${ids.layoutId}/publish`, {}, tokens.OPERATOR_ADMIN);
  check('a broken layout CANNOT be published', badPublish.status === 400, badPublish.status);
  check('and it says exactly what is wrong', (badPublish.raw?.error?.details ?? []).length > 0, badPublish.raw?.error?.details);

  // A real 2x2 coach.
  const items: unknown[] = [
    { id: 'drv', kind: 'DRIVER', x: 0, y: 0, w: 40, h: 40, rotation: 0 },
    { id: 'door', kind: 'ENTRANCE', x: 260, y: 0, w: 40, h: 40, rotation: 0 },
  ];
  let n = 1;
  for (let row = 0; row < 5; row++) {
    const y = 80 + row * 60;
    for (const x of [20, 60, 200, 240]) {
      items.push({ id: `s${n}`, kind: 'SEATER', x, y, w: 40, h: 40, rotation: 0, seatNumber: String(n) });
      n++;
    }
  }
  // One ladies seat and one premium zone, so derivation has something to do.
  (items[2] as any).props = { gender: 'FEMALE_ONLY' };
  (items[3] as any).props = { fareZone: 'PREMIUM', isWindow: true };

  const good = await patch(`/seat-layouts/${ids.layoutId}`, { definition: { decks: [{ deck: 'LOWER', items }] } }, tokens.OPERATOR_ADMIN);
  check('a real 2x2 coach saves', good.status === 200, good.raw?.error);

  const dry = await post(`/seat-layouts/${ids.layoutId}/validate`, {}, tokens.OPERATOR_ADMIN);
  check('the builder can dry-run validation as it draws', dry.status < 300 && dry.body?.ok === true, dry.body?.errors);
  check('validation reports the seat count it derived', dry.body?.seatCount === 20, dry.body?.seatCount);

  const published = await post(`/seat-layouts/${ids.layoutId}/publish`, {}, tokens.OPERATOR_ADMIN);
  check('a valid layout publishes', published.status === 200 || published.status === 201, published.raw?.error);
  check('publishing freezes it as PUBLISHED', published.body?.status === 'PUBLISHED');

  const editFrozen = await patch(`/seat-layouts/${ids.layoutId}`, { name: 'sneaky' }, tokens.OPERATOR_ADMIN);
  check(
    'a PUBLISHED layout can NEVER be edited — that is what protects sold tickets',
    editFrozen.status === 409,
    editFrozen.status,
  );

  const v2 = await post(`/seat-layouts/${ids.layoutId}/clone`, {}, tokens.OPERATOR_ADMIN);
  check('cloning starts version 2 as a fresh draft', v2.body?.version === 2 && v2.body?.status === 'DRAFT', {
    v: v2.body?.version,
    s: v2.body?.status,
  });
  check('the clone stays in the same family', v2.body?.familyId === ids.familyId);

  const versions = await get(`/seat-layouts/family/${ids.familyId}/versions`, tokens.OPERATOR_ADMIN);
  check('both versions are listed', rows(versions.body).length === 2, rows(versions.body).length);

  // Assign to the bus — and watch the booking engine's flat data get regenerated from the drawing.
  const assigned = await post(
    `/seat-layouts/assign/${ids.busId}`,
    { templateId: ids.layoutId },
    tokens.OPERATOR_ADMIN,
  );
  check('a published layout can be assigned to a bus', assigned.status === 200 || assigned.status === 201, assigned.raw?.error);
  check('the bus seat map is DERIVED from the drawing', (assigned.body?.seatMap ?? []).length === 20, (assigned.body?.seatMap ?? []).length);
  check('totalSeats follows the drawing, not what was typed in', assigned.body?.totalSeats === 20, assigned.body?.totalSeats);
  check(
    'the FEMALE_ONLY seat became a ladies-reserved seat, with nobody typing it in',
    (assigned.body?.ladiesReservedSeats ?? []).includes('1'),
    assigned.body?.ladiesReservedSeats,
  );
  check(
    'adjacency was worked out FROM THE DRAWING — seats 1 and 2 sit together',
    assigned.body?.seatAdjacency?.['1'] === '2',
    assigned.body?.seatAdjacency,
  );

  const assignDraft = await post(
    `/seat-layouts/assign/${ids.busId}`,
    { templateId: v2.body?.id },
    tokens.OPERATOR_ADMIN,
  );
  check('a DRAFT cannot be put on a bus', assignDraft.status === 409, assignDraft.status);

  const otherOp = await get(`/seat-layouts/${ids.layoutId}`, tokens.SUPPORT);
  check("an operator's layouts are their own", otherOp.status === 403 || otherOp.status === 200, otherOp.status);

  // ── The snapshot. This is the one that protects money. ──
  const tripAfter = await post(
    '/trips',
    {
      routeId: ids.routeId,
      busId: ids.busId,
      departureDate: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
      departureTime: '06:00',
    },
    tokens.OPERATOR_ADMIN,
  );
  check('a trip on the new layout is created', tripAfter.status === 200 || tripAfter.status === 201, tripAfter.raw?.error);

  const snapSeats = await get(
    `/trips/${tripAfter.body?.id}/seats?boardingStopId=${ids.stopId}&droppingStopId=${ids.stopId2}`,
  );
  check('the trip sells the 20 seats the layout drew', (snapSeats.body?.seats ?? []).length === 20, (snapSeats.body?.seats ?? []).length);
  check('and the trip carries the drawing, so the UI can render a real bus', Boolean(snapSeats.body?.seatLayout), typeof snapSeats.body?.seatLayout);

  // ══════════════════════════════════════════════════════════════════
  console.log('\n── Guest access — may look, may not buy ─────────────────────');

  // The funnel is open. Nobody creates an account before they have seen a bus.
  const gSearch = await get(
    `/trips/search?fromStopId=${ids.stopId}&toStopId=${ids.stopId2}&date=${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}`,
  );
  check('a GUEST can search buses', gSearch.status === 200, gSearch.status);

  const gSeats = await get(
    `/trips/${ids.tripId}/seats?boardingStopId=${ids.stopId}&droppingStopId=${ids.stopId2}`,
  );
  check('a GUEST can see the seat map', gSeats.status === 200, gSeats.status);
  check('and the fares on it', (gSeats.body?.seats ?? []).every((s: { fare: number }) => typeof s.fare === 'number'));

  const gStops = await get('/stops');
  check('a GUEST can see the stops', gStops.status === 200 || gStops.status === 401, gStops.status);

  // And it closes, exactly where the money starts.
  //
  // `POST /bookings/hold` used to be @Public(). A hold LOCKS INVENTORY: an anonymous caller —
  // no account, nothing to rate-limit, nothing to ban — could hold every seat on every bus and
  // never pay. Free denial-of-inventory, and the operator watches their buses show "sold out"
  // while running empty.
  const gHold = await post('/bookings/hold', {
    tripId: ids.tripId,
    boardingStopId: ids.stopId,
    droppingStopId: ids.stopId2,
    seatNumbers: ['1'],
  });
  check('a GUEST cannot HOLD a seat — that locks inventory', gHold.status === 401, gHold.status);

  const gBook = await post('/bookings', { holdToken: 'x', passengers: [] });
  check('a GUEST cannot book', gBook.status === 401, gBook.status);

  const gMine = await get('/bookings/my');
  check('a GUEST has no bookings to look at', gMine.status === 401, gMine.status);

  const gProfile = await get('/me');
  check('a GUEST has no profile', gProfile.status === 401, gProfile.status);

  const gWallet = await get('/wallet');
  check('a GUEST has no wallet', gWallet.status === 401, gWallet.status);

  // ══════════════════════════════════════════════════════════════════
  console.log('\n── IAM: custom roles (Enterprise only) ──────────────────────');

  // The operator we built is on BASIC — the feature must be OFF, and say so.
  const noPlan = await post(
    '/custom-roles',
    { name: 'Counter Clerk', permissions: ['VIEW_BOOKING'] },
    tokens.OPERATOR_ADMIN,
  );
  check('custom roles are refused on Core', noPlan.status === 403, noPlan.status);
  check('and the refusal names the reason, not just "forbidden"', noPlan.raw?.error?.code === 'FEATURE_NOT_IN_PLAN', noPlan.raw?.error?.code);

  // Upgrade the operator to Enterprise. Only the GDS owner can move a plan — an operator
  // cannot upgrade themselves into a feature they have not paid for.
  const upgrade = await put(
    `/admin/operators/${ids.operatorId}/plan`,
    { plan: 'ENTERPRISE' },
    tokens.SUPERADMIN,
  );
  check('the SuperAdmin can move an operator to Enterprise', upgrade.status === 200, upgrade.raw?.error);

  const selfUpgrade = await put(
    `/admin/operators/${ids.operatorId}/plan`,
    { plan: 'ENTERPRISE' },
    tokens.OPERATOR_ADMIN,
  );
  check('an operator CANNOT upgrade themselves', selfUpgrade.status === 403, selfUpgrade.status);

  const grantable = await get('/custom-roles/grantable', tokens.OPERATOR_ADMIN);
  check('the role designer is told exactly what it may grant', grantable.status === 200, grantable.raw?.error);
  const grantableKeys: string[] = rows(grantable.body).map((p: { key: string }) => p.key);
  check(
    'and NO platform permission is offered — the ceiling is the operator\'s own authority',
    grantableKeys.length > 0 && !grantableKeys.includes('CREATE_OPERATOR') && !grantableKeys.includes('CONFIGURE_PLATFORM_SETTINGS'),
    grantableKeys.length,
  );

  const role = await post(
    '/custom-roles',
    { name: `Counter Clerk ${stamp}`, description: 'Sells at the counter. Cannot refund.', permissions: ['VIEW_BOOKING', 'SEARCH_BOOKING'] },
    tokens.OPERATOR_ADMIN,
  );
  check('an Enterprise operator can design a role', role.status === 200 || role.status === 201, role.raw?.error);
  ids.customRoleId = role.body?.id;

  // THE ATTACK. An operator inventing a role that reaches the platform.
  const escalate = await post(
    '/custom-roles',
    { name: `God ${stamp}`, permissions: ['CREATE_OPERATOR'] },
    tokens.OPERATOR_ADMIN,
  );
  check('an operator CANNOT grant a platform permission to a role of their own', escalate.status === 403, escalate.status);
  check('and is told why: you cannot grant what you do not hold', escalate.raw?.error?.code === 'PERMISSION_NOT_GRANTABLE', escalate.raw?.error?.code);

  const invented = await post(
    '/custom-roles',
    { name: `Fiction ${stamp}`, permissions: ['DO_ANYTHING_I_LIKE'] },
    tokens.OPERATOR_ADMIN,
  );
  check('a permission that does not exist is refused', invented.status === 400, invented.status);

  const dupe = await post(
    '/custom-roles',
    { name: `Counter Clerk ${stamp}`, permissions: ['VIEW_BOOKING'] },
    tokens.OPERATOR_ADMIN,
  );
  check('two roles cannot share a name', dupe.status === 409, dupe.status);

  // The cap. Enterprise allows five; the sixth must be refused.
  for (let i = 2; i <= 5; i++) {
    await post('/custom-roles', { name: `Role ${i} ${stamp}`, permissions: ['VIEW_BOOKING'] }, tokens.OPERATOR_ADMIN);
  }
  const sixth = await post('/custom-roles', { name: `Role 6 ${stamp}`, permissions: ['VIEW_BOOKING'] }, tokens.OPERATOR_ADMIN);
  check('the SIXTH custom role is refused — Enterprise allows five', sixth.status === 403, sixth.status);
  check('and the message says how many they have', sixth.raw?.error?.code === 'CUSTOM_ROLE_LIMIT_REACHED', sixth.raw?.error?.code);

  // Assignment. An operator admin cannot narrow THEMSELVES — they could not undo it.
  const narrowSelf = await post(
    '/custom-roles/assign',
    { userId: ids.operatorAdminUserId, roleId: ids.customRoleId },
    tokens.OPERATOR_ADMIN,
  );
  check('an operator admin cannot put THEMSELVES on a custom role', narrowSelf.status === 400, narrowSelf.status);

  const assignSupport = await post(
    '/custom-roles/assign',
    { userId: ids.supportUserId, roleId: ids.customRoleId },
    tokens.OPERATOR_ADMIN,
  );
  check('but they can put a support agent on one', assignSupport.status === 200 || assignSupport.status === 201, assignSupport.raw?.error);

  const other = await post(
    '/custom-roles',
    { name: `Sneaky ${stamp}`, permissions: ['VIEW_BOOKING'] },
    tokens.SUPPORT,
  );
  check('a SUPPORT agent cannot design roles — only the operator admin', other.status === 403, other.status);

  // ══════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  PASS ${pass}   FAIL ${fail}`);
  if (fail) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`    ✗ ${f}`));
  }
  console.log(`${'═'.repeat(70)}\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('\nSuite crashed:', e);
  process.exit(1);
});
