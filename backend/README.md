# Yoo Bus — Backend

NestJS 10 · TypeORM · Postgres

## Run

```bash
npm install --legacy-peer-deps
cp .env.example .env          # point DB_* at your Postgres
npm run seed                  # creates ONE account (below)
npm run start:dev             # http://localhost:3000/api/v1  (docs: /api/v1/docs)
```

## The only seeded account

```
superadmin@yoobus.com / pass@123
```

Nothing else. Yoo Bus is the SaaS platform, not a bus company — so there is no operator row
either. Everything is created through the API/UI, because a screen that cannot create its
own data is a screen with a bug, and seeding around it would only hide the bug.

## The two layers

```
Yoo Bus (platform · operatorId = null)
├── SUPERADMIN         owns the platform, global settings, onboarding
├── ACCOUNTANT         SaaS billing, operator invoices, settlements
└── PLATFORM_SUPPORT   Yoo Bus's own desk — works ACROSS operators
        │
        │  POST /operators/apply → /leads/:id/kyc → /verify → /approve
        ▼
    Operator (a bus company · operatorId required)
    ├── OPERATOR_ADMIN  runs one operator, adds its own staff
    ├── SUPPORT         that operator's desk — its own tickets only
    └── DRIVER          that operator's driver

CUSTOMER — passenger, belongs to no operator.
```

Platform staff are created by the SuperAdmin at `POST /users/platform-staff`
(only ACCOUNTANT and PLATFORM_SUPPORT — a second SuperAdmin can never be minted there).
Operator staff are created by their own admin at `POST /users/staff`.

Platform and operations are **separate estates, not nested ones**. The SuperAdmin runs the
SaaS and has 72 platform permissions; the Operator Admin runs the buses and has 115
operations permissions. Neither is a superset of the other — that separation is the point.
The SuperAdmin observes operators read-only through `/admin/operators/:id/*`.

## There is no tenant

Not a table, not a column, not a word. An operator IS the unit of tenancy: every
operator-scoped table carries `operatorId`, and `PermissionsGuard` + `RolesGuard` enforce
isolation on every request. Adding a second `tenants` key on top would just be two names
for one row.

## Tests

```bash
npm run test:logic     # 1,829 pure-logic assertions, no DB
npm run test:e2e       # 70 scenarios over HTTP
npm run test:api       # every route × every role — 2,562 probes
npm run test:all       # all three
```

Start the server and seed first (`npm run seed`, `npm run start:dev`), then run them.

**Nothing here is mocked.** The suites sign in for real, onboard an operator through KYC,
create staff, map a bus to a route, hold a seat, take a booking, and cancel it for a refund.

`test:api` is the one that enforces *"jis role ke liye functionality hai, sirf usi ko
dikhegi"*. It walks all 369 routes against all 7 roles and asserts three things:

| | |
|---|---|
| **No route returns 500** | a client mistake must never read as a server fault |
| **No role reaches a route it was not granted** | a disallowed role gets 403 — always |
| **No granted role is locked out of its own route** | the guard must not over-refuse |

Plus an anonymous pass over every guarded route: all must answer 401.

The UI hiding a menu item is a courtesy. This is the enforcement — and it is the only part
an attacker cannot bypass.

If you add a controller, regenerate the inventory first, or the matrix will "pass" simply by
never probing your new endpoint:

```bash
npm run routes:scan
```

## Bugs this found (all fixed)

| Bug | Why it mattered |
|---|---|
| `EmailModule` never imported `NotificationSettingsModule` | **the app could not boot at all** |
| `SettingEntryDto.value` had no validator, under `whitelist + forbidNonWhitelisted` | every Global Settings save returned 400 |
| No `POST /users/platform-staff` existed | Yoo Bus could not create its own Accountant or Support |
| `sendMail()` awaited with no timeout | one unreachable SMTP host hung requests for ~2 minutes |
| `CreateLeadDto` still demanded `subdomain` | no operator could sign up |
| 14 routes granted a platform role, then did `u.operatorId!` | a platform role has no operatorId — instant 500 |
| `JwtStrategy` used `findById()`, which throws 404 | a revoked/deleted account read as 404, not 401 |
| Invalid uuid in a path went to Postgres raw | `/buses/not-a-uuid` → 500 instead of 400 |
| `:period` and `:namespace` unvalidated | garbage in the URL → 500 |
| 12 endpoints typed their body inline | Nest skips validation on inline types — password reset and RBAC overrides accepted **any** payload |
