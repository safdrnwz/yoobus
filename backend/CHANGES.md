# Yoo Bus — Backend Changes

All changes are backend-only. The frontend was not modified. No DB migration is required in
development (the app builds the schema from entities via `synchronize`); for production, generate
migrations from the updated entities. Everything is in English and follows the existing
architecture (services, `{ok,code,message}` invariants, per-operator isolation, RBAC catalog).

## A. Plans/tiers removed — every operator is equal, with per-operator billing

- Removed the entire plan / subscription / entitlement-gating system. Every operator now has
  **every feature, unlimited**: no feature flags, no limits, no bus-type or booking-window
  restrictions, unlimited messaging, custom roles available to all (safety cap of 5 kept).
- Deleted: plan catalogue, plan-entitlements, subscription utils, `subscriptions` module,
  `plan-purchase` entity, `FeatureGuard` + `@RequireFeature`, the entitlements controller.
- `EntitlementsService` is kept as a thin internal "everything allowed" access shim so the ~14
  services that call it did not have to change. It still resolves one thing: the per-operator
  **commission** rate.
- **Per-operator billing config** (on the `operators` table, set by the SuperAdmin, different for
  every operator):
  - `oneTimePlatformFee` — flat one-time onboarding fee (a `PLATFORM_FEE` invoice is generated on
    approval when > 0).
  - `setupFeePerBus` — existing per-bus setup fee (unchanged).
  - `commissionRate` — % of fare per seat (unchanged; tax/settlement untouched).
  - `smsCharge`, `whatsappCharge`, `emailCharge` — billed **per message actually sent**.
  - `extraCharges` (jsonb) — extensible named charges.
- SuperAdmin sets these at **approval** (`ApproveDto`) and later via **`PUT /admin/operators/:id`**.
- They surface in **`GET /finance/summary`** (`platformBilling` block: one-time fee, setup fee,
  commission rate, monthly comms charges = messages × rates, extra charges) and in the SuperAdmin
  **operator billing** view (`admin` billingOf now returns billingConfig + full summary).
- SaaS billing module kept (ad-hoc operator invoicing).

## Bug fix — coupon cross-operator leak

`finance/coupons` `list()` accepted an operatorId and then ignored it, returning every operator's
coupons to every operator. It is now scoped: an operator sees only its own + platform-wide
coupons; platform staff see all.

## B. New operator staff roles (add-on)

Added four first-class, operator-scoped staff roles the Operator Admin can add as the business
grows (optional — the admin already holds all these powers and delegates only when they choose):

- **OPERATIONS_MANAGER** — routes, schedules, trips, seat inventory, boarding, disruption,
  forecasting, operations dashboard.
- **FINANCE_MANAGER** — financial dashboard, ledger, invoices, GST/revenue reports, settlements,
  refunds, coupons/pricing, period close.
- **DEPOT_MANAGER** — buses, drivers, crew-HR, fuel, fleet maintenance (operator-scoped; per-depot
  row-level scoping is a future enhancement).
- **CREW** — boarding, QR scan, manifest, assigned schedule/route view.

Each role has a scoped permission set in the single permission catalog, logs in with its own
credentials, and (via the existing guards) sees **only** its own functionality. The Operator Admin
creates them through the existing staff endpoint; permission overrides per role also work. No
migration needed (role is a string column).

## C. GPS Integration module (`modules/operator/gps`)

New self-contained module implementing the provided spec.

- **Providers** (SuperAdmin): Fleetx, LocoNav, Traccar, Wialon, Ajjas, BlackBox GPS,
  Mappls InTouch, Custom API — enable/disable per platform. `GET/PUT /gps/providers`.
- **Operator config**: `GET/PUT /gps/config`, `POST /gps/config/test` (provider, base URL, key,
  secret, client id, access token, webhook URL; status UNTESTED/CONNECTED/DISCONNECTED). An
  operator can only configure a provider the platform has enabled.
- **Device mapping**: `GET/POST/DELETE /gps/devices` — map an operator's bus to a device (IMEI),
  operator-isolated.
- **Passenger tracking**: `POST /gps/tracking/:bookingId` issues **one** token per booking
  (valid from 1h before departure, through the trip, then expired). Public capability read at
  **`GET /track/:token`** returns only that booking's tracking, scoped by the token.
- **Permissions**: `MANAGE_GPS_PROVIDER` (SuperAdmin), `CONFIGURE_GPS` / `MAP_GPS_DEVICE`
  (Operator Admin + Depot Manager), existing `VIEW_LIVE_TRACKING` (passenger/staff).
- **New tables**: `gps_providers`, `gps_configurations`, `gps_devices`, `gps_tracking_tokens`.
- **Edge cases** handled: GPS offline (live position returns null), wrong credentials (test →
  DISCONNECTED), bus not mapped (blocked at token creation), token expired / trip cancelled
  (`expireForTrip`).

### Provider-specific stubs to complete
- `GpsService.livePosition()` — plug in each provider's HTTP call (returns null/offline until
  then, so the UI degrades gracefully rather than showing a fake position).
- Tracking-link WhatsApp/Email notifications — wire to the messaging/email templates.

## D. Cleanup round — removed duplicate/unneeded modules + email/KYC fixes

Verified with the real TypeScript compiler (`tsc --noEmit`, **0 errors** across src + tests) and
the logic test suites (**1780 checks, 0 failures**).

**Removed (duplicate/unneeded):**
- `platform/entitlements` — plans are gone, so the access shim was dead weight. Every call site
  (`assertWithinLimit`, `assertBusType`, `assertBookingWindow`, `assertCanAddAdmin`,
  `creditsForChannel`, `assertFeatureByTrip`) was a no-op and has been removed. Commission is read
  directly from the operator row where needed, so nothing behavioural changed. Messaging is
  billed per message (no credit cap), so it always sends.
- `platform/operator-lifecycle` — duplicated the real operator onboarding pipeline that already
  lives in `operator/operators` (apply → KYC → verify → approve).
- `platform/marketplace` — not needed.
- `operator/workflow` (+ `common/logic/workflow.util.ts`) — not needed.

**Email — fixed (it was silently not sending):**
- Root cause: `.env` had `EMAIL_DEV_MODE=true`, which only logs mail to the console and sends
  nothing. Set to **`false`**. With the configured Gmail SMTP (SMTP_USER/SMTP_PASS app password),
  registration, apply, approval, staff and all other mail now actually send. Send failures are
  logged (never crash the request; the transporter has 5s/10s timeouts).

**Operator onboarding (apply → KYC → approve) — completed:**
- `POST /operators/apply` now emails the applicant a **KYC link that carries the lead id and needs
  no login**: `{APP_PUBLIC_URL}/operators/leads/{leadId}/kyc` (new `APP_PUBLIC_URL` env, default
  `http://localhost:3000/api/v1`).
- `PATCH /operators/leads/:id/kyc` is now **public** (`@Public`) — the applicant submits KYC via the
  emailed link without a bearer token. The lead id (a UUID) is the capability. Approval remains
  SuperAdmin-only.

## E. Email integration — verified end-to-end and made bulletproof

Email lives in `modules/integrations/email` and is already wired across **20 modules** (auth, OTP,
password reset/change, new-device, verify; bookings, passenger transfer, reviews, seat alerts and
upgrades; wallet, fare-freeze, payments incl. refunds, settlements; bus setup invoice, daily
statement, disruption, maintenance, operator onboarding, reminders, support tickets, trips).

- Confirmed **every template used anywhere is defined** in `templates.ts` (no silent send failures).
- **`EMAIL_DEV_MODE=false`** so mail is actually sent via the Gmail SMTP in `.env`
  (SMTP_USER / SMTP_PASS App Password). Port 587 uses STARTTLS (`requireTLS`), 465 implicit TLS.
- On boot the service runs `transporter.verify()` and logs whether the SMTP credentials work — a
  wrong Gmail App Password is now obvious at startup instead of failing silently on every send.
- **Bulletproof:** `renderTemplate` never throws (unknown/faulty template → safe generic mail), and
  the whole `send()` is best-effort — any mail error is logged and swallowed, so email can never
  break the operation that triggered it (registration, approval, booking, etc.). Send failures are
  recorded in `email_logs` with status SENT / FAILED / SUPPRESSED / BLOCKED / DEV / ERROR.

## F. Frontend — synced to the backend

The frontend (React + Vite + TypeScript, in `frontend/`) was brought back in line with the
backend. Verified: **`tsc --noEmit` 0 errors**, **`vite build` succeeds**, and the
frontend→backend **contract check passes** (every UI call maps to a real route; every role and
permission the UI uses exists).

- **Roles synced** — `roles.ts` now has Operations Manager, Finance Manager, Depot Manager and
  Crew, with labels, home routes, and creatable-role lists. The generated DTO role union picked
  them up automatically from the backend enum.
- **Dead features removed** (their backend modules are gone): subscription plans, subscriptions,
  marketplace, workflow/approvals, operator-lifecycle — their API clients, pages, routes and nav
  entries were deleted. This is why the contract check is green.
- **GPS Integration UI added** (`features/settings/pages/GpsIntegrationPage.tsx` +
  `gps.api.ts`): SuperAdmin provider on/off toggles, the operator's provider configuration with a
  Test Connection button, and bus↔device mapping — all gated by the same permissions the backend
  enforces (`MANAGE_GPS_PROVIDER`, `CONFIGURE_GPS`, `MAP_GPS_DEVICE`). Reachable at
  `/settings/gps`.
- `backend/test/routes.json` was regenerated (`npm run routes:scan`) so the contract tooling sees
  the new GPS routes and no longer sees the removed ones (351 routes).

Note: 136 backend routes still have no UI (e.g. some GPS/passenger-tracking and niche platform
endpoints) — not errors, just screens not built yet.

## G. Operator onboarding reworked — single apply form, no KYC step

- **One API only — `POST /operators/apply`.** The application now carries everything in one form:
  company + contact details AND full KYC (GSTIN, PAN, legal name, address, bank details) with
  document attachment URLs, in an optional `kyc` object. It is stored on the lead at apply time.
- **Removed the separate KYC endpoint** (`PATCH /operators/leads/:id/kyc`) and its DTO. The apply
  email no longer contains a KYC link — that link is gone entirely.
- **Email on every status change.** Applying → “Application received”; marked contacted →
  “Under review” (new `OPERATOR_UNDER_REVIEW` template); verification started →
  “Verification in progress”; approved → “Account activated”; rejected → “Application update”.
- **Credentials are emailed, never returned by the API.** On approval the temporary password is
  sent only in the `OPERATOR_APPROVED` email (with a Sign-in button). The approve API response now
  returns `{ operator, operatorCode, message }` — no password, no secret.
- **Email templates redesigned.** New reusable `hero`, `callout` (key/value card) and `button`
  helpers give the onboarding emails a clean, branded, attractive layout with status banners and a
  highlighted credentials box. All emails share the same polished shell.
- Onboarding pipeline relaxed to match the new flow (no forced DOCS_SUBMITTED step); approve/verify
  are blocked only once a lead is already approved or rejected.

Verified: backend `tsc` 0 errors, logic suites 1780/0; frontend `tsc` 0 errors, contract OK,
`vite build` succeeds; `routes.json` regenerated (350 routes, KYC route removed).

## H. Public "Become an Operator" form + email design for every template

**Frontend apply form** (`features/onboarding/pages/OperatorApplyPage.tsx`, public route
`/become-an-operator`, linked from the sign-in page): one no-login form that collects everything
the backend apply API now accepts — company, contact, and full KYC (legal name, GSTIN, PAN,
address, bank details) plus document links — and posts it to `POST /operators/apply`. On success
it shows a confirmation ("we've emailed you; you'll hear from us at every step"); no credentials or
secrets are ever shown in the UI. Verified: `tsc` 0 errors, contract OK, `vite build` succeeds.

**Email design applied to all templates.** The shared email shell (`wrap()`, used by every one of
the ~44 templates) was upgraded: a tri-colour accent bar, a rounded brand logo badge, and a
refined rounded status banner. Because every template renders through this shell, all emails now
share the polished, branded look — with the onboarding flow carrying the richest treatment (hero
headline, key/value callout cards, status banner, credentials box, CTA button). Auth, booking and
finance emails already used structured helpers (headline, OTP box, detail tables, notices) and now
sit in the upgraded shell too.

## I. GSTIN uniqueness + hardened apply-form validation

**GSTIN can never map to two operators (backend + frontend).**
- Backend: `POST /operators/apply` now checks the applicant's GSTIN/PAN (which arrive in the `kyc`
  object) against every existing operator AND every open application — a duplicate GSTIN (or PAN) is
  rejected at apply time with `OPERATOR_DUPLICATE_GSTIN` / `OPERATOR_DUPLICATE_PAN`, not just at
  approval — checked against operators AND open applications. The `operators` table also enforces
  GSTIN & PAN uniqueness at the database level (partial unique indexes), so a duplicate is
  impossible even under a race. **PAN is unique exactly like GSTIN.**
- Frontend: GSTIN is required and format-checked; if the backend still rejects it (already taken),
  the error is shown inline on the GSTIN field.

**Apply form — validation everywhere + no double submit.**
- Every field is validated on the client with inline error messages: company, contact, a valid
  email, a 10-digit mobile, at least one bus, and correctly-formatted GSTIN, PAN, IFSC, pincode and
  document links. GSTIN/PAN/IFSC auto-uppercase as you type. The backend re-validates everything
  and remains the source of truth.
- The submit button is disabled while the request is in flight (and the handler guards on
  `isPending`), so a double-click can never create two applications.
- Text inputs restyled — rounded, larger touch targets, hover and focus rings, and red error
  states with messages.

## J. Entity ↔ DTO audit — two gaps fixed

Reviewed the changed entities and DTOs for missing/mismatched fields. Two real issues found & fixed:

1. **KYC nested validation wasn't running.** `CreateLeadDto.kyc` was validated only as `@IsObject()`,
   so the field-level validators inside `KycDetailsDto` never fired. Added `@ValidateNested()` +
   `@Type(() => KycDetailsDto)`, and added **GSTIN/PAN format validation on the backend** (matching
   the frontend) — a malformed GSTIN/PAN sent directly to the API is now rejected.
2. **`UpdateOperatorDto.isActive` had no matching column.** The `operators` table uses a `status`
   enum, not an `isActive` boolean, so `Object.assign` silently dropped it and activate/suspend from
   the admin panel did nothing. `isActive` now maps to `status` (ACTIVE / SUSPENDED).

Everything else (Operator, OperatorLead, ApproveDto, GPS entities/DTOs, SetupInvoice,
notification-settings) is consistent. Backend `tsc` 0 errors, logic suites 1780/0.

## K. Two sites from one frontend, split by hostname

The single frontend now serves two different experiences depending on the host (`src/core/env/host.ts`
decides, and `routes.tsx` picks the route tree):

- **Customer site — `yoobus.com`** (dev: **`localhost:5173`**): search & book tickets. A guest lands
  straight on the search page and only signs in when a seat is held. Routes: `/` and `/search`
  (public), `/sign-in`, `/register`, `/forgot-password`, `/become-an-operator`, and the passenger
  area (`/travel/trips`, `/travel/wallet`, `/travel/loyalty`, `/account`).
- **Staff console — `app.yoobus.com`** (dev: **`app.localhost:5173`**): SuperAdmin, Operator Admin
  and all operator staff. The full console (platform, operations, fleet, finance, support, driver,
  settings). Customer signup links are hidden on this host.

`app.localhost` resolves to 127.0.0.1 in modern browsers, so the same split works locally with no
hosts-file edits. Vite dev `allowedHosts` now includes `app.localhost`; set `VITE_FORCE_APP=true` to
force the console on a plain `localhost`. In production, point both `yoobus.com` and
`app.yoobus.com` at the same built SPA (e.g. one nginx serving the `dist/`), and set the backend
`APP_CORS_ORIGINS` to both domains (dev default `*` already allows both).

Verified: `tsc` 0 errors, contract OK, `vite build` succeeds.

## L. Email links wired + premium header/footer

Every email now links to the right place, split across the two sites:
- **Two base URLs** — `CUSTOMER_URL` (yoobus.com) and `APP_URL` (app.yoobus.com), from `FRONTEND_URL`
  / `APP_FRONTEND_URL`. Customer actions (book, verify email, reset password, seat upgrade, wallet,
  my trips) link to the customer site; operator/staff actions (operator approved → sign in,
  dashboard, finance) link to the app console.
- **Fixed broken/placeholder links:** buttons used to point at a hardcoded `app.yoobus.com` (even
  customer actions) or `#`. "Book your first trip", "Book now", "Verify email", password reset &
  change, and seat-upgrade links now resolve correctly; the operator-approved "Sign in to your
  dashboard" button goes to the app console.
- **Premium header** — clickable brand logo, plus real "Book a trip / Open console" and "Sign in"
  links (they follow the email's site).
- **Premium footer** — real navigation links (Book a Trip / My Trips / Wallet for customers;
  Dashboard / Operations / Finance for staff), a support email, a divider, and the copyright line.
- `wrap()` gained a `site: 'customer' | 'app'` option so each email's header/footer links point to
  the correct site (defaults to customer).

Verified: backend `tsc` 0 errors.

## M. "Become an Operator" button on the customer site header

The customer site (yoobus.com) now shows a prominent **"Become an Operator"** button at the top-right
of the header (on search and every guest screen, for both guests and signed-in customers). Clicking
it opens the public apply form (`/become-an-operator`) and submits to `POST /operators/apply`. The
button lives only on the customer header — it is not present anywhere on the staff console
(app.yoobus.com).

## N. Operator applications pipeline + dead-menu cleanup

**Applications pipeline (SuperAdmin).** When an operator applies it now lands on a dedicated
SuperAdmin screen — **Platform → Applications** (`/platform/applications`). Each application shows
company, contact, GSTIN, fleet size and its **stage**, and moves through the pipeline with a button
at each step:
- NEW → **Mark contacted**
- NEW / CONTACTED → **Start verification** (this was missing on the frontend — the backend
  `/operators/leads/:id/verify` had no caller; added `startVerification` to the API)
- open → **Approve** (creates the operator account, emails the login credentials) / **Reject**
  (prompts for a reason, which is emailed to the applicant)

Previously the only operator screen showed *active operators* (suspend/activate) — there was no way
to see or act on incoming applications.

**Dead menus removed / fixed (bulletproof).** Cross-checked every sidebar item against the real
routes:
- Removed **Subscriptions / "My subscription"** menu items — that backend module was deleted, so the
  links went nowhere.
- Restored the **Platform settings** route (`/settings/platform` → PlatformSettingsPage), which had
  been dropped during the customer/app host split while the menu item still pointed at it.
- Verified: **every remaining sidebar item now maps to a real route and a real backend endpoint**
  (contract check green), for every role.

## O. Role-based menus made backend-driven (deep audit)

Audited every sidebar item and route against the backend's actual role/permission grants. The menus
now show each role exactly what the backend assigns it — nothing more, nothing less.

- **Menus are permission-driven.** Where an item had both a permission (`anyOf`) and a redundant
  `roles` filter, the `roles` filter was removed on both the sidebar and the route. Visibility now
  follows the user's effective permissions from `GET /rbac/me` (backend role defaults + operator
  overrides). This is what made the new staff roles work: Operations Manager, Finance Manager, Depot
  Manager and Crew now see exactly the operations / finance / fleet / boarding menus their backend
  permissions allow, instead of being hidden by an operator-admin-only `roles` gate.
- **Fixed 3 "menu lies"** — items that were shown to a role the backend would 403:
  Overview (was shown to Accountant; server allows SuperAdmin only), Reviews and Sales channels
  (were shown to SuperAdmin; server allows the operator/support roles). Both the menu and the route
  were corrected to the backend's real role list.
- **Verified by the contract checker**, which reads the backend's `@Roles` from `routes.json`: every
  menu maps to a real route, every permission/role the UI uses exists, and no menu is shown to a role
  the server would reject.

## P. YooBus brand + attractive customer landing

- **Brand wordmark** — a new `<Brand>` component renders **YooBus** everywhere with **"Yoo" in black
  and "Bus" in red**, next to a custom **SVG bus logo mark** (red rounded badge with a friendly bus).
  It replaces the old dynamic brand text in the sidebar, auth screens, public header and footer, with
  tone variants for light / dark / inherited surfaces.
- **Customer landing** — the public site now opens with an attractive hero: a soft red→amber gradient
  band, a bold "Book your bus in seconds" headline, trust badges, and a decorative **SVG scene**
  (city skyline, a red bus on a dashed road, sun). Search still sits right below it.
- Verified: `tsc` 0 errors, `vite build` succeeds, contract check green (no frontend call or menu
  without a real backend route/role).

## Q. Part 1 (Finance) — page-based, no modals

Starting the systematic build-out. The rule from here on: **create/edit/detail are full pages, never
modals.**

- **Coupons** rebuilt page-based: a list screen (`/finance/coupons`) with a "New coupon" button that
  navigates to a dedicated **create page** (`/finance/coupons/new`) — no modal dialog. The create page
  has per-field validation with inline errors (code, type, value, caps, limits, validity), submits to
  `POST /coupons`, then returns to the list. (The coupons backend exposes list + create + validate;
  there is no update/delete endpoint, so the UI matches exactly.)
- Establishes the pattern (list page + separate form page) that the remaining resources will follow.

Verified: frontend `tsc` 0 errors, `vite build` succeeds, contract green.

## R. Part 2 start + LaunchKit design shift (in progress)

- **Operations (Part 2) started:** Stops converted to page-based create (no modal) via the reusable
  `createHref`. The remaining operations resources (Buses, Routes, Drivers, Schedules, Hubs,
  Counters) still use the shared modal form and are pending page conversion.
- **LaunchKit look — foundation:** the app shell is being shifted toward the LaunchKit design.
  - Sidebar: active item is now a solid dark pill with light text; section labels are monospace.
  - PageHeader: monospace breadcrumb, a "• SECTION" eyebrow, and a bold headline on every screen.
- Everything remains green: frontend `tsc` 0 errors, `vite build` succeeds, contract check passes.

Note: a pixel-perfect 100% match of the full external design is best finished with a live preview
(Claude Design), since it needs visual iteration on spacing/sizing/colours that can't be verified
from code + build alone. The wiring to the backend (role-based menus, real modules) stays here.
