/**
 * Role → menu test.
 *
 * "Jis role ke liye functionality hai, sirf usi ko dikhegi" — this is the frontend half of
 * that promise. The backend half (`backend/test/api-matrix.ts`) proves the server refuses a
 * role that reaches for something it was not granted. This one proves the UI does not even
 * offer it.
 *
 * It is not a mock. It signs each of the 7 roles into the REAL backend, takes the REAL
 * permissions from GET /rbac/me, and runs the REAL Sidebar filter over the REAL nav config.
 * What comes out is exactly the menu that role would see in the browser.
 *
 * Run:  node dist/main.js && npm run seed   (backend, once)
 *       npm run test:menu                    (here)
 */
import { NAV_SECTIONS, type NavItem } from '../src/navigation/nav.config';
import { Role } from '../src/core/rbac/roles';

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

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let raw: any = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = text;
  }
  return { status: res.status, body: raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw };
}

/**
 * The EXACT filter Sidebar.tsx applies. If this drifts from the component, the test is
 * lying — so it is copied deliberately, not re-implemented from memory.
 */
function menuFor(role: string, permissions: Set<string>): string[] {
  const hasRole = (...roles: string[]) => roles.includes(role);
  const canAny = (perms: string[]) => perms.some((p) => permissions.has(p));

  return NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item: NavItem) => {
        if (item.roles && !hasRole(...(item.roles as string[]))) return false;
        if (item.anyOf && !canAny(item.anyOf as string[])) return false;
        return true;
      })
      .map((item: NavItem) => item.to),
  );
}

async function main(): Promise<void> {
  console.log('\n═══ Yoo Bus — role → menu ═══\n');

  const stamp = Date.now();
  const mob = (n: number) => String(9000000000 + ((stamp + n) % 999999999)).slice(0, 10);
  const pan = (n: number) => `AABC${String.fromCharCode(65 + ((stamp + n) % 26))}${String(stamp).slice(-4)}R`;
  const gst = (n: number) => `0${(n % 9) + 1}${pan(n)}1ZX`;

  // ---- sign every role in, for real ----
  const tokens: Record<string, string> = {};

  const sa = await call('POST', '/auth/login', { identifier: 'superadmin@yoobus.com', password: 'pass@123' });
  tokens.SUPERADMIN = sa.body?.accessToken;
  if (!tokens.SUPERADMIN) throw new Error('SuperAdmin login failed — run `npm run seed` in backend/');

  for (const [role, n] of [['ACCOUNTANT', 21], ['PLATFORM_SUPPORT', 22]] as const) {
    const email = `${role.toLowerCase()}${stamp}@yoobus.com`;
    const made = await call(
      'POST',
      '/users/platform-staff',
      { email, fullName: `Yoo Bus ${role}`, phone: mob(n), role },
      tokens.SUPERADMIN,
    );
    const login = await call('POST', '/auth/login', { identifier: email, password: made.body?.tempPassword });
    tokens[role] = login.body?.accessToken;
  }

  const lead = await call('POST', '/operators/apply', {
    companyName: `Sharma Travels ${stamp}`,
    contactName: 'Ravi Sharma',
    email: `ravi${stamp}@sharma.com`,
    mobile: mob(1),
    city: 'Delhi',
    totalBuses: 10,
  });
  await call('PATCH', `/operators/leads/${lead.body?.id}/kyc`, {
    gstin: gst(1),
    pan: pan(1),
    legalName: `Sharma Travels Pvt Ltd ${stamp}`,
    address: { line1: 'Karol Bagh', city: 'Delhi', state: 'DL', pincode: '110005' },
    bankDetails: { accountNumber: '123456789012', ifsc: 'HDFC0001234', accountName: 'Sharma' },
    documents: { gstCertificate: 'gst.pdf', panCard: 'pan.pdf' },
  }, tokens.SUPERADMIN);
  await call('PATCH', `/operators/leads/${lead.body?.id}/verify`, {}, tokens.SUPERADMIN);
  const approved = await call('PATCH', `/operators/leads/${lead.body?.id}/approve`, {}, tokens.SUPERADMIN);

  const oa = await call('POST', '/auth/login', {
    identifier: approved.body?.adminEmail,
    password: approved.body?.tempPassword,
  });
  tokens.OPERATOR_ADMIN = oa.body?.accessToken;

  for (const [role, n] of [['SUPPORT', 2], ['DRIVER', 3]] as const) {
    const email = `${role.toLowerCase()}${stamp}@sharma.com`;
    const made = await call(
      'POST',
      '/users/staff',
      { email, fullName: `Op ${role}`, phone: mob(n), role },
      tokens.OPERATOR_ADMIN,
    );
    const login = await call('POST', '/auth/login', { identifier: email, password: made.body?.tempPassword });
    tokens[role] = login.body?.accessToken;
  }

  const paxEmail = `pax${stamp}@gmail.com`;
  const reg = await call('POST', '/auth/register', {
    fullName: 'Test Passenger',
    email: paxEmail,
    phone: mob(4),
    password: 'Pax@12345',
    consentGiven: true,
  });
  if (reg.body?.devOtp) await call('POST', '/auth/verify-email', { email: paxEmail, otp: reg.body.devOtp });
  const pax = await call('POST', '/auth/login', { identifier: paxEmail, password: 'Pax@12345' });
  tokens.CUSTOMER = pax.body?.accessToken;

  // ---- build each role's real menu ----
  const menus: Record<string, string[]> = {};

  for (const role of Object.values(Role)) {
    check(`${role} can sign in`, !!tokens[role]);
    if (!tokens[role]) continue;

    const me = await call('GET', '/rbac/me', undefined, tokens[role]);
    const list: string[] = Array.isArray(me.body)
      ? me.body
      : Array.isArray(me.body?.permissions)
        ? me.body.permissions
        : (Object.values(me.body ?? {}).find(Array.isArray) as string[]) ?? [];

    menus[role] = menuFor(role, new Set(list));
    console.log(`\n  ${role}  (${list.length} permissions) sees ${menus[role].length} menu items:`);
    console.log(`    ${menus[role].join('  ') || '— NOTHING —'}`);
  }

  console.log('\n── Assertions ───────────────────────────────────────────────');

  // 1. Nobody lands on an empty app.
  for (const role of Object.values(Role)) {
    check(`${role} sees a non-empty menu`, (menus[role]?.length ?? 0) > 0, menus[role]);
  }

  // 2. The SaaS-admin screens are for platform people only.
  //
  //    Note what is NOT asserted: /platform/subscriptions and /platform/audit are shared
  //    routes — the server hands an operator its OWN subscription and its OWN audit trail
  //    there. They live under the operator's own menu section, so an operator reaching them
  //    is correct. The screens that must never leak are the ones that manage OTHER people:
  //    the operator register, onboarding, plans, SaaS billing, API partners, reliability.
  const SAAS_ADMIN_ONLY = [
    '/platform/operators',
    '/platform/operator-lifecycle',
    '/platform/plans',
    '/platform/saas-billing',
    '/platform/api-management',
    '/platform/reliability',
    '/platform/marketplace',
    '/platform/analytics',
    '/platform/overview',
  ];
  for (const role of [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.DRIVER, Role.CUSTOMER]) {
    const leaked = (menus[role] ?? []).filter((to) => SAAS_ADMIN_ONLY.includes(to));
    check(`${role} sees NO SaaS-admin screens`, leaked.length === 0, leaked);
  }

  // 3. Fleet/operations belong to the operator. Yoo Bus staff run the SaaS; they do not
  //    drive buses, and the SuperAdmin has no CREATE_BUS permission to hide behind.
  for (const role of [Role.SUPERADMIN, Role.ACCOUNTANT, Role.PLATFORM_SUPPORT]) {
    const ops = (menus[role] ?? []).filter((to) => to.startsWith('/operations') || to.startsWith('/fleet'));
    check(`${role} sees NO fleet/operations screens`, ops.length === 0, ops);
  }

  // 4. A passenger sees their travel screens, their notifications, and live tracking of the
  //    bus they are on — and nothing that belongs to an operator or to Yoo Bus.
  const paxMenu = menus[Role.CUSTOMER] ?? [];
  const PAX_ALLOWED = ['/travel', '/support/notifications', '/driver/tracking'];
  check(
    'CUSTOMER sees only passenger screens',
    paxMenu.every((to) => PAX_ALLOWED.some((p) => to.startsWith(p))),
    paxMenu.filter((to) => !PAX_ALLOWED.some((p) => to.startsWith(p))),
  );

  // 5. A driver sees the driver screens and nothing administrative.
  const drvMenu = menus[Role.DRIVER] ?? [];
  check('DRIVER sees the boarding screen', drvMenu.some((to) => to.startsWith('/driver')), drvMenu);
  check(
    'DRIVER sees no settings/administration',
    !drvMenu.some((to) => to.startsWith('/settings')),
    drvMenu.filter((to) => to.startsWith('/settings')),
  );

  // 6. The two support desks differ: the platform one works across operators, the operator's
  //    own one does not. Both must land somewhere useful.
  check('PLATFORM_SUPPORT sees the support desk', (menus[Role.PLATFORM_SUPPORT] ?? []).some((to) => to.startsWith('/support')));
  check('SUPPORT sees the support desk', (menus[Role.SUPPORT] ?? []).some((to) => to.startsWith('/support')));

  // 7. The accountant is platform finance — billing, not buses.
  const acctMenu = menus[Role.ACCOUNTANT] ?? [];
  check('ACCOUNTANT sees SaaS billing', acctMenu.includes('/platform/saas-billing'), acctMenu);
  check('ACCOUNTANT sees NO fleet screens', !acctMenu.some((to) => to.startsWith('/fleet')), acctMenu);

  // 8. Only the SuperAdmin can reach global settings and onboarding.
  for (const role of Object.values(Role)) {
    if (role === Role.SUPERADMIN) continue;
    const settings = (menus[role] ?? []).filter((to) => to.includes('/settings/appearance') || to.includes('/platform/operators'));
    check(`${role} cannot see global settings or operator onboarding`, settings.length === 0, settings);
  }

  console.log(`\n${'═'.repeat(66)}`);
  console.log(`  PASS ${pass}   FAIL ${fail}`);
  if (fail) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`    ✗ ${f}`));
  }
  console.log(`${'═'.repeat(66)}\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('\nSuite crashed:', e);
  process.exit(1);
});
