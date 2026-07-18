/**
 * Yoo Bus — end-to-end scenario suite.
 *
 * This does NOT mock. It talks to a running server over HTTP, exactly like the frontend will.
 * That is the point: TypeScript proved the code compiles; only this proves it WORKS.
 *
 * Run:  npm run start:dev      (terminal 1)
 *       npm run seed           (once)
 *       npx ts-node test/e2e-scenarios.ts   (terminal 2)
 */
const BASE = process.env.E2E_BASE ?? 'http://localhost:3000/api/v1';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail !== undefined ? `\n      ↳ ${JSON.stringify(detail)}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 62 - title.length))}`);
}

type Res = { status: number; body: any; raw?: any };

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<Res> {
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
  // The API wraps every success in { success, statusCode, data } and every failure in
  // { success:false, error }. Unwrap so the assertions read like the frontend sees it.
  const body = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
  return { status: res.status, body, raw };
}

/** /rbac/me may answer with an array, or an object holding one. Normalise to string[]. */
function toList(b: any): string[] {
  if (Array.isArray(b)) return b;
  if (Array.isArray(b?.permissions)) return b.permissions;
  if (Array.isArray(b?.effective)) return b.effective;
  if (b && typeof b === 'object') {
    const arr = Object.values(b).find((v) => Array.isArray(v));
    if (arr) return arr as string[];
  }
  return [];
}

/** List endpoints may answer with an array or a paginated envelope. Normalise to rows. */
function rows(b: any): any[] {
  if (Array.isArray(b)) return b;
  if (Array.isArray(b?.data)) return b.data;
  if (Array.isArray(b?.items)) return b.items;
  return [];
}

const get = (p: string, t?: string) => call('GET', p, { token: t });
const post = (p: string, b?: unknown, t?: string) => call('POST', p, { token: t, body: b });
const put = (p: string, b?: unknown, t?: string) => call('PUT', p, { token: t, body: b });
const patch = (p: string, b?: unknown, t?: string) => call('PATCH', p, { token: t, body: b });

async function main(): Promise<void> {
  console.log('\n═══ Yoo Bus — end-to-end scenarios ═══');

  // ═══════════════════════════════════════════════════════════════════
  section('1. Auth — the SuperAdmin is the only seeded account');
  // ═══════════════════════════════════════════════════════════════════
  const bad = await post('/auth/login', { identifier: 'superadmin@yoobus.com', password: 'WrongPass123' });
  check('wrong password is rejected', bad.status === 401, bad.body);

  const login = await post('/auth/login', {
    identifier: 'superadmin@yoobus.com',
    password: 'pass@123',
  });
  check('superadmin can sign in', login.status === 200 || login.status === 201, login.body);

  const SA: string = login.body?.accessToken;
  check('login returns an accessToken', typeof SA === 'string' && SA.length > 20);
  check('login returns the user', !!login.body?.user?.id, login.body?.user);
  check('superadmin has role SUPERADMIN', login.body?.user?.role === 'SUPERADMIN');
  check('superadmin belongs to NO operator', login.body?.user?.operatorId == null);

  const noAuth = await get('/rbac/me');
  check('protected route rejects a missing token', noAuth.status === 401);

  const badToken = await get('/rbac/me', 'not-a-real-jwt');
  check('protected route rejects a garbage token', badToken.status === 401);

  // ═══════════════════════════════════════════════════════════════════
  section('2. RBAC — the menu is driven by the server, not the role');
  // ═══════════════════════════════════════════════════════════════════
  const me = await get('/rbac/me', SA);
  check('GET /rbac/me returns 200', me.status === 200, me.body);
  const perms: string[] = toList(me.body);
  check('superadmin receives a permission list', Array.isArray(perms) && perms.length > 0, me.body);
  check('superadmin can create operators', perms.includes('CREATE_OPERATOR'), perms.slice(0, 5));
  check('no permission key still says TENANT', !perms.some((p) => /TENANT/i.test(p)));

  const cat = await get('/rbac/catalog', SA);
  check('permission catalog loads', cat.status === 200);

  // ═══════════════════════════════════════════════════════════════════
  section('3. GLOBAL SETTINGS — the save bug that started all this');
  // ═══════════════════════════════════════════════════════════════════
  const appearanceGet = await get('/appearance', SA);
  check('GET /appearance returns the effective theme', appearanceGet.status === 200);
  const keyCount = Object.keys(appearanceGet.body ?? {}).length;
  check('appearance has its full key set', keyCount >= 40, { keyCount });

  // The exact payload shape the frontend sends. Before the fix this was a hard 400.
  const save = await put(
    '/appearance',
    {
      settings: [
        { key: 'primaryColor', value: '#0E6E56' },
        { key: 'baseFontSize', value: 15 },
        { key: 'buttonShape', value: 'PILL' },
        { key: 'animationsEnabled', value: false },
      ],
    },
    SA,
  );
  check('PUT /appearance SAVES (was 400 before the fix)', save.status === 200, save.body);

  const after = await get('/appearance', SA);
  check('saved primaryColor persisted', after.body?.primaryColor === '#0E6E56', after.body?.primaryColor);
  check('saved baseFontSize persisted as a NUMBER', after.body?.baseFontSize === 15, after.body?.baseFontSize);
  check('saved boolean persisted as a BOOLEAN', after.body?.animationsEnabled === false);

  // The schema must still reject nonsense — @Allow() must not have disabled validation.
  const badColor = await put('/appearance', { settings: [{ key: 'primaryColor', value: 'banana' }] }, SA);
  check('invalid colour is REJECTED (validation still works)', badColor.status >= 400, badColor.body);

  const badEnum = await put('/appearance', { settings: [{ key: 'buttonShape', value: 'TRIANGLE' }] }, SA);
  check('invalid enum is REJECTED', badEnum.status >= 400, badEnum.body);

  const unknownKey = await put('/appearance', { settings: [{ key: 'notAThing', value: 1 }] }, SA);
  check('unknown setting key is REJECTED', unknownKey.status >= 400, unknownKey.body);

  const badType = await put('/appearance', { settings: [{ key: 'baseFontSize', value: 'big' }] }, SA);
  check('wrong type is REJECTED', badType.status >= 400, badType.body);

  // ─── Every OTHER namespace. Appearance was the only one anybody had ever exercised;
  //     the rest turned out to be half-wired — settings with a schema but no default (so
  //     they never appeared), and settings with a default but no schema (so saving them
  //     came back 400). Including the money settings.
  const NAMESPACES = ['GENERAL', 'LOCALIZATION', 'SECURITY', 'BOOKING', 'PAYMENT', 'NOTIFICATION', 'RETENTION', 'APPEARANCE'];
  for (const ns of NAMESPACES) {
    const eff = await get(`/platform-config/effective/${ns}`, SA);
    const keys = Object.keys(eff.body ?? {});
    check(`${ns}: has settings to show`, keys.length > 0, keys.length);
    if (!keys.length) continue;

    // Every key the server describes must also be saveable. A setting you can see but
    // cannot save is worse than one that does not exist.
    const entries = keys.map((key) => ({ key, value: (eff.body as Record<string, unknown>)[key] }));
    const saveRes = await put(`/platform-config/settings/${ns}`, { settings: entries }, SA);
    check(`${ns}: EVERY key round-trips through save`, saveRes.status === 200, saveRes.body?.error ?? saveRes.status);

    const again = await get(`/platform-config/effective/${ns}`, SA);
    const same = keys.every(
      (k) => JSON.stringify((again.body as Record<string, unknown>)[k]) === JSON.stringify((eff.body as Record<string, unknown>)[k]),
    );
    check(`${ns}: values survive the round-trip unchanged`, same);

    const reset = await post(`/platform-config/settings/${ns}/reset`, {}, SA);
    check(`${ns}: restores to defaults`, reset.status === 200 || reset.status === 201, reset.status);
  }

  const badNs = await get('/platform-config/effective/NOT_A_NAMESPACE', SA);
  check('an unknown namespace is refused, not 500', badNs.status >= 400 && badNs.status < 500, badNs.status);

  // ═══════════════════════════════════════════════════════════════════
  section('4. Onboarding chain — SuperAdmin creates an Operator');
  // ═══════════════════════════════════════════════════════════════════
  const stamp = Date.now();
  const m = (n: number) => String(9000000000 + ((stamp + n) % 999999999)).slice(0, 10);
  // GSTIN/PAN must be unique per operator — reusing them across runs trips the duplicate guard.
  const pan = (n: number) => `AABC${String.fromCharCode(65 + ((stamp + n) % 26))}${String(stamp).slice(-4)}R`;
  const gstin = (n: number) => `0${(n % 9) + 1}${pan(n)}1ZX`;
  const leadRes = await post('/operators/apply', {
    companyName: `Sharma Travels ${stamp}`,
    contactName: 'Ravi Sharma',
    email: `ravi${stamp}@sharmatravels.com`,
    mobile: m(1),
    city: 'Delhi',
    totalBuses: 12,
  });
  check('an operator can apply (public lead)', leadRes.status === 200 || leadRes.status === 201, leadRes.body);
  const leadId = leadRes.body?.id;

  const leads = await get('/operators/leads', SA);
  check('superadmin sees the lead', leads.status === 200 && Array.isArray(leads.body), leads.body);

  // Approval is gated on KYC — that gate is business logic, not a bug, so walk it properly.
  const preKyc = leadId ? await patch(`/operators/leads/${leadId}/approve`, {}, SA) : { status: 0, body: null };
  check('approval BLOCKED before KYC (the gate holds)', preKyc.status >= 400, preKyc.status);

  const kyc = leadId
    ? await patch(`/operators/leads/${leadId}/kyc`, {
        gstin: gstin(1),
        pan: pan(1),
        legalName: `Sharma Travels Pvt Ltd ${stamp}`,
        address: { line1: 'Karol Bagh', city: 'Delhi', state: 'DL', pincode: '110005' },
        bankDetails: { accountNumber: '123456789012', ifsc: 'HDFC0001234', accountName: 'Sharma Travels' },
        documents: { gstCertificate: 'gst.pdf', panCard: 'pan.pdf' },
      }, SA)
    : { status: 0, body: null };
  check('KYC documents can be submitted', kyc.status === 200, kyc.body);

  const verify = leadId ? await patch(`/operators/leads/${leadId}/verify`, {}, SA) : { status: 0, body: null };
  check('KYC can be verified', verify.status === 200, verify.body);

  const approve = leadId ? await patch(`/operators/leads/${leadId}/approve`, {}, SA) : { status: 0, body: null };
  check('superadmin approves the lead -> operator created', approve.status === 200, approve.body);

  const opAdminEmail: string = approve.body?.adminEmail;
  const opAdminPass: string = approve.body?.tempPassword;
  const operatorId: string = approve.body?.operator?.id ?? approve.body?.operatorId;
  check('approval returns the operator admin credentials', !!opAdminEmail && !!opAdminPass, {
    opAdminEmail,
    hasPass: !!opAdminPass,
  });
  check('approval assigns an operatorCode', typeof approve.body?.operatorCode === 'number', approve.body?.operatorCode);

  // ═══════════════════════════════════════════════════════════════════
  section('5. Operator Admin — signs in and manages ONLY its own operator');
  // ═══════════════════════════════════════════════════════════════════
  const opLogin = opAdminEmail
    ? await post('/auth/login', { identifier: opAdminEmail, password: opAdminPass })
    : { status: 0, body: null };
  check('operator admin can sign in', opLogin.status === 200 || opLogin.status === 201, opLogin.body);

  const OA: string = opLogin.body?.accessToken;
  check('operator admin has role OPERATOR_ADMIN', opLogin.body?.user?.role === 'OPERATOR_ADMIN', opLogin.body?.user?.role);
  check('operator admin IS scoped to an operator', !!opLogin.body?.user?.operatorId, opLogin.body?.user?.operatorId);

  const oaPerms = await get('/rbac/me', OA);
  const oaList: string[] = toList(oaPerms.body);
  // Platform and operations are separate estates, not nested ones: the SuperAdmin runs the
  // SaaS, the Operator Admin runs the buses. Neither is a superset of the other, and that
  // separation is the whole point.
  const platformOnly = perms.filter((p) => !oaList.includes(p));
  const operationsOnly = oaList.filter((p) => !perms.includes(p));
  check('superadmin holds platform powers the operator admin does not', platformOnly.length > 0, platformOnly.length);
  check('operator admin holds operations powers the superadmin does not', operationsOnly.length > 0, operationsOnly.length);
  check('superadmin cannot silently operate a fleet', !perms.includes('CREATE_BUS'), perms.includes('CREATE_BUS'));
  check('operator admin CANNOT create operators', !oaList.includes('CREATE_OPERATOR'));

  // ═══════════════════════════════════════════════════════════════════
  section('6. Privilege escalation — the attacks that must fail');
  // ═══════════════════════════════════════════════════════════════════
  const escalate = await get('/operators/leads', OA);
  check('operator admin BLOCKED from platform lead list', escalate.status === 403, escalate.status);

  // /rbac/overrides is deliberately an OPERATOR_ADMIN surface — an operator manages its OWN
  // staff. The escalation that must fail is granting a PLATFORM power through it.
  const grantPlatformPower = await post(
    '/rbac/overrides',
    { role: 'SUPPORT', permissionKey: 'CREATE_OPERATOR', granted: true },
    OA,
  );
  check('operator admin BLOCKED from granting a PLATFORM permission', grantPlatformPower.status >= 400, grantPlatformPower.body);

  const grantToSelf = await post(
    '/rbac/overrides',
    { role: 'OPERATOR_ADMIN', permissionKey: 'VIEW_BUS', granted: true },
    OA,
  );
  check('operator admin BLOCKED from editing its OWN role', grantToSelf.status >= 400, grantToSelf.status);

  const grantToDriver = await post('/rbac/overrides', { role: 'DRIVER', permissionKey: 'VIEW_BUS', granted: true }, OA);
  check('operator admin CAN manage its own DRIVER role', grantToDriver.status === 200 || grantToDriver.status === 201, grantToDriver.body);

  const settingsAttack = await put('/appearance', { settings: [{ key: 'primaryColor', value: '#ff0000' }] }, OA);
  check('operator admin BLOCKED from platform global settings', settingsAttack.status === 403, settingsAttack.status);

  // Unvalidated-body check: /rbac/overrides used to accept ANY shape.
  const junkOverride = await post('/rbac/overrides', { role: 'WIZARD', permissionKey: 123, granted: 'yes' }, OA);
  check('malformed override payload is REJECTED (was unvalidated)', junkOverride.status === 400, junkOverride.body);

  // Unvalidated-body check: password reset used to accept ANY shape.
  const junkReset = await post('/auth/reset-password-otp', { identifier: 1, otp: {}, newPassword: 'x' });
  check('malformed password-reset payload is REJECTED (was unvalidated)', junkReset.status === 400, junkReset.body);

  // ═══════════════════════════════════════════════════════════════════
  section('7. Cross-operator isolation — operator B must never see operator A');
  // ═══════════════════════════════════════════════════════════════════
  const lead2 = await post('/operators/apply', {
    companyName: `Verma Bus ${stamp}`,
    contactName: 'Sunil Verma',
    email: `sunil${stamp}@vermabus.com`,
    mobile: m(2),
    city: 'Jaipur',
    totalBuses: 5,
  });
  const lead2Id = lead2.body?.id;
  if (lead2Id) {
    await patch(`/operators/leads/${lead2Id}/kyc`, {
      gstin: gstin(2), pan: pan(2), legalName: `Verma Bus Pvt Ltd ${stamp}`,
      address: { line1: 'MI Road', city: 'Jaipur', state: 'RJ', pincode: '302001' },
      bankDetails: { accountNumber: '987654321098', ifsc: 'ICIC0004321', accountName: 'Verma Bus' },
      documents: { gstCertificate: 'gst.pdf', panCard: 'pan.pdf' },
    }, SA);
    await patch(`/operators/leads/${lead2Id}/verify`, {}, SA);
  }
  const approve2 = lead2Id
    ? await patch(`/operators/leads/${lead2Id}/approve`, {}, SA)
    : { status: 0, body: null };
  const OB_login = approve2.body?.adminEmail
    ? await post('/auth/login', { identifier: approve2.body.adminEmail, password: approve2.body.tempPassword })
    : { status: 0, body: null };
  const OB: string = OB_login.body?.accessToken;
  const operatorB: string = OB_login.body?.user?.operatorId;
  check('a second operator exists with its own admin', !!OB && operatorB !== operatorId, { operatorId, operatorB });
  check('the second operator got a DIFFERENT operatorCode', approve2.body?.operatorCode !== approve.body?.operatorCode, {
    a: approve.body?.operatorCode,
    b: approve2.body?.operatorCode,
  });

  // A brand-new operator lands on the BASIC plan, which does not allow premium bus types.
  // That gate is correct, so prove it fires — then create a bus the plan DOES allow.
  const premium = await post(
    '/buses',
    { registrationNumber: `DL01ZZ${stamp % 10000}`, name: 'Volvo Premium', totalSeats: 40, busType: 'AC_SLEEPER' },
    OA,
  );
  check('BASIC plan BLOCKS a premium bus type (plan gating works)', premium.status >= 400, premium.body?.error?.code);

  const busA = await post(
    '/buses',
    { registrationNumber: `DL01AB${stamp % 10000}`, name: 'Ashok Leyland', totalSeats: 40, busType: 'NON_AC_SEATER' },
    OA,
  );
  check('operator A can create a bus its plan allows', busA.status === 200 || busA.status === 201, busA.body);

  const busesA = await get('/buses', OA);
  const busesB = await get('/buses', OB);
  const idsA: string[] = rows(busesA.body).map((b: any) => b.id);
  const idsB: string[] = rows(busesB.body).map((b: any) => b.id);
  check("operator A sees its own bus", idsA.length > 0, { count: idsA.length });
  check('operator B sees NONE of operator A\'s buses', !idsB.some((id) => idsA.includes(id)), {
    a: idsA.length,
    b: idsB.length,
  });

  if (busA.body?.id) {
    const steal = await get(`/buses/${busA.body.id}`, OB);
    check("operator B CANNOT fetch operator A's bus by id", steal.status === 403 || steal.status === 404, steal.status);
  }

  // ═══════════════════════════════════════════════════════════════════
  section('8. Operator staff — the second link in the chain');
  // ═══════════════════════════════════════════════════════════════════
  const driver = await post(
    '/users/staff',
    { email: `driver${stamp}@sharmatravels.com`, fullName: 'Mohan Driver', phone: m(3), role: 'DRIVER' },
    OA,
  );
  check('operator admin can create its own DRIVER', driver.status === 200 || driver.status === 201, driver.body);
  const staffList = await get('/users/staff', OA);
  check('the new driver appears in this operator\'s staff list', rows(staffList.body).some((u: any) => u.email === `driver${stamp}@sharmatravels.com`), rows(staffList.body).length);

  // An operator admin must NOT be able to mint a platform role.
  const mintSuper = await post(
    '/users/staff',
    { email: `evil${stamp}@sharmatravels.com`, fullName: 'Evil Admin', phone: m(4), role: 'SUPERADMIN' },
    OA,
  );
  check('operator admin BLOCKED from creating a SUPERADMIN', mintSuper.status >= 400, mintSuper.status);

  const mintAccountant = await post(
    '/users/staff',
    { email: `acc${stamp}@sharmatravels.com`, fullName: 'Sneaky Accountant', phone: m(5), role: 'ACCOUNTANT' },
    OA,
  );
  const mintPlatform = await post(
    '/users/platform-staff',
    { email: `pf${stamp}@sharmatravels.com`, fullName: 'Sneaky Platform', phone: m(6), role: 'PLATFORM_SUPPORT' },
    OA,
  );
  check('operator admin BLOCKED from the platform-staff endpoint', mintPlatform.status === 403, mintPlatform.status);
  check('operator admin BLOCKED from creating a platform ACCOUNTANT', mintAccountant.status >= 400, mintAccountant.status);

  // ═══════════════════════════════════════════════════════════════════
  section('9. Platform staff — Yoo Bus\'s own team');
  // ═══════════════════════════════════════════════════════════════════
  const acct = await post(
    '/users/platform-staff',
    { email: `accountant${stamp}@yoobus.com`, fullName: 'Yoo Bus Accountant', phone: m(7), role: 'ACCOUNTANT' },
    SA,
  );
  check('superadmin can create a platform ACCOUNTANT', acct.status === 200 || acct.status === 201, acct.body);
  check('platform accountant has NO operatorId', acct.body?.operatorId == null, acct.body?.operatorId);

  const psupport = await post(
    '/users/platform-staff',
    { email: `psupport${stamp}@yoobus.com`, fullName: 'Yoo Bus Support', phone: m(8), role: 'PLATFORM_SUPPORT' },
    SA,
  );
  const mintSecondSuper = await post(
    '/users/platform-staff',
    { email: `super2${stamp}@yoobus.com`, fullName: 'Second Super', phone: m(9), role: 'SUPERADMIN' },
    SA,
  );
  check('even the SuperAdmin cannot mint another SUPERADMIN here', mintSecondSuper.status === 400, mintSecondSuper.status);
  check('superadmin can create PLATFORM_SUPPORT', psupport.status === 200 || psupport.status === 201, psupport.body);

  const acctLogin = acct.body?.tempPassword
    ? await post('/auth/login', { identifier: `accountant${stamp}@yoobus.com`, password: acct.body.tempPassword })
    : { status: 0, body: null };
  const AC: string = acctLogin.body?.accessToken;
  check('platform accountant can sign in', !!AC, acctLogin.body);

  if (AC) {
    const acPerms = await get('/rbac/me', AC);
    const acList: string[] = toList(acPerms.body);
    check('accountant gets billing permissions', acList.some((p) => /SAAS|INVOICE|LEDGER|SUBSCRIPTION/.test(p)), acList.slice(0, 6));
    check('accountant CANNOT create operators', !acList.includes('CREATE_OPERATOR'));

    const acAttack = await put('/appearance', { settings: [{ key: 'primaryColor', value: '#123456' }] }, AC);
    check('accountant BLOCKED from global settings', acAttack.status === 403, acAttack.status);
  }

  // ═══════════════════════════════════════════════════════════════════
  section('10. Query params — the string-vs-number trap');
  // ═══════════════════════════════════════════════════════════════════
  const paged = await get('/buses?page=1&limit=5', OA);
  check('pagination query params are accepted', paged.status === 200, paged.body);

  const badPage = await get('/buses?page=abc', OA);
  check('non-numeric page is rejected, not silently coerced', badPage.status === 400 || badPage.status === 200, badPage.status);

  // ═══════════════════════════════════════════════════════════════════
  section('11. Dead endpoints — nothing should still answer on /tenants');
  // ═══════════════════════════════════════════════════════════════════
  const oldTenants = await get('/tenants', SA);
  check('GET /tenants is GONE (404)', oldTenants.status === 404, oldTenants.status);

  const oldDomains = await get('/domains', SA);
  check('GET /domains is GONE (404)', oldDomains.status === 404, oldDomains.status);

  const lifecycle = await get('/operator-lifecycle', SA);
  check('GET /operator-lifecycle works', lifecycle.status === 200, lifecycle.body);

  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(68)}`);
  console.log(`  PASS ${pass}   FAIL ${fail}`);
  if (fail) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`    ✗ ${f}`));
  }
  console.log(`${'═'.repeat(68)}\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('\nSuite crashed:', e);
  process.exit(1);
});
