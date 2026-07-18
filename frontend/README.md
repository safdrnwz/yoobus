# Yoo Bus Console — Frontend

An enterprise React + TypeScript console for the Yoo Bus Mobility platform: multi-tenant bus
operations, ticketing, fleet care, finance and support, with a SuperAdmin-controlled
**Global Settings** module that re-skins the entire product at runtime.

---

## Running it

The backend must be up first (NestJS, default `http://localhost:3000`).

```bash
npm install
cp .env.example .env      # already provided
npm run dev               # http://localhost:5173
```

Vite proxies `/api` to `localhost:3000`, so there is nothing to configure for local work.

```bash
npm run typecheck         # tsc, no emit
npm run build             # production bundle
npm run preview           # serve the build
```

### Demo accounts

Password for all of them: `pass@123`

| Account | Role | Lands on |
|---|---|---|
| `superadmin@yoobus.com` | Platform SuperAdmin | Platform overview — **the only role that can open Global Settings** |
| `accountant@yoobus.com` | Platform Accountant | SaaS billing |
| `admin@yoobus.com` | Operator Admin | Operations dashboard |
| `support@yoobus.com` | Support | Tickets |
| `driver@yoobus.com` | Driver | Boarding |
| `customer@yoobus.com` | Passenger | My trips |

Sign in with each and the product is visibly a different application — the menu, the routes and
the row actions are all built from that user's *effective* permissions.

---

## Global Settings

**Where:** Administration → Global settings (`/settings/appearance`). Visible to SuperAdmin only.

Every colour, typeface, radius, button style, density and layout value in the console is a CSS
custom property written at runtime by `ThemeProvider`. Tailwind's theme resolves entirely to
those properties (`tailwind.config.ts` contains no literal colours), so saving a theme repaints
every screen with no reload, no re-render and no redeploy.

What is controllable:

- **Brand** — product name, logo, favicon, footer text, motion on/off
- **Colour** — theme mode (Light / Dark / Custom), primary, secondary, accent, background,
  surface, text, muted text, border, sidebar, footer, and the four status colours
- **Typography** — body / heading / figure typefaces, base size, modular scale ratio, line
  height, letter spacing, body and heading weights
- **Buttons** — default variant (solid / outline / soft / ghost), shape (square / rounded /
  pill), size, corner radius, label weight, uppercase
- **Layout** — corner radius, border width, shadow level, density, sidebar width, content
  width, sidebar collapsed by default
- **History** — every save snapshots the previous theme; any revision can be restored

Editing a control previews the change across the whole console immediately. Nothing is sent to
the server until **Save theme**, and the topbar shows a "Previewing unsaved theme" badge while a
draft is live.

Derived tokens (hover states, soft tints, readable foreground colours) are computed from the
admin's choices in `src/theme/apply-theme.ts`, so a badly-chosen colour cannot produce
unreadable text. Colour fields warn when a pairing falls below the WCAG AA contrast ratio.

### This required a backend change

The backend had **no theming/appearance settings**. It was extended (see the patched backend):

- `APPEARANCE` namespace added to `PLATFORM_DEFAULTS`, with ~45 validated keys
- Schema, enums and validators added to `platform-config.util.ts`
- `setSettingsBulk()` and `resetNamespace()` added to `PlatformConfigService` — a theme is
  saved as **one atomic, versioned change** rather than one write per key
- New `AppearanceController`:

| Route | Access | Why |
|---|---|---|
| `GET /appearance` | **Public** | The sign-in screen must paint the brand before anyone has a token |
| `PUT /appearance` | SuperAdmin + `CONFIGURE_PLATFORM_SETTINGS` | Save the theme |
| `POST /appearance/reset` | SuperAdmin + `CONFIGURE_PLATFORM_SETTINGS` | Back to defaults |
| `GET /appearance/versions` | SuperAdmin + `VIEW_CONFIG_VERSIONS` | Restore history |

It is a separate controller because `PlatformConfigController` carries a class-level
`@Roles(SUPERADMIN)`, and a public route cannot live under that gate.

---

## Architecture

```
src/
  core/            The things every feature depends on
    api/           http-client (envelope unwrap, single-flight refresh), ApiError, query client
    auth/          token storage, auth store
    rbac/          roles, permission keys, <Can> guard
    utils/         cn, format, date, download
    hooks/         debounce, pagination, disclosure, media query
  theme/           Global Settings engine: types, defaults, apply-theme, ThemeProvider
  components/
    ui/            Button, Input, Card, Badge, DataTable, Modal, Tabs, StatCard, ColorField…
    layout/        AppShell, Sidebar, Topbar, Footer, PageHeader, ErrorBoundary
    common/        ResourcePage — the declarative CRUD engine
  navigation/      nav.config.ts — the menu as data, gated per item
  features/        One folder per domain: api/ + pages/
    auth booking operations fleet finance support platform settings travel account dashboard
  app/
    providers/     QueryProvider, AuthProvider
    router/        routes.tsx, guards.tsx
```

**Feature-based, not layer-based.** A feature owns its API client and its screens. Nothing
outside `core/` and `components/` is shared, so a module can be deleted without archaeology.

### The API layer

`core/api/http-client.ts` is the only thing that talks to the backend.

- Unwraps the `{ success, statusCode, data }` envelope so callers see payloads, not wrappers
- Normalises every failure into a single `ApiError` — no component ever handles an Axios error
- **Single-flight refresh:** when a token expires, several queries 401 at the same instant.
  Refreshing per-request would fire N refreshes, and because the backend *rotates* refresh
  tokens, all but the first would be rejected and the user would be signed out mid-session.
  Instead the first 401 starts one refresh; everything else waits on that promise and is
  replayed with the new token.

Access tokens live in memory only. The refresh token is persisted, because "stay signed in"
across reloads is a product requirement, and the backend hashes, rotates and revokes it.

### RBAC

Permissions are **never inferred from the role**. On sign-in the app calls `GET /rbac/me` for
the user's *effective* permissions (role defaults + tenant overrides) and drives the menu, the
routes and the row actions from that set.

The UI hiding a button is a courtesy, not a control — the backend guards every route and returns
403 regardless of what the client renders. Global Settings is enforced in three places: the nav
item, the route guard, and the server.

### The resource engine

Most screens in an operations console are the same screen: a filtered list, a create form, a few
permission-gated row actions. Forty hand-written versions of that produce forty subtly different
behaviours. `components/common/ResourcePage.tsx` takes a config instead — columns, fields,
actions, permissions — and the loading, empty, error, confirmation and toast behaviour is
identical everywhere. Adding a backend module becomes a config object, not a new screen.

Anything that genuinely isn't that shape is hand-written and doesn't use it: the seat map, the
boarding scanner, the permissions matrix, the theme studio, the dashboards.

### Design

The palette comes from highway signage — pine green, deep navy ink, and a signal amber reserved
for things that need to be noticed. Figures (fares, PNRs, seat counts) are set in a mono face
with tabular numerals so columns line up and a changing value doesn't shift the layout.

The signature element is the **lane marker**: a 3px rail that marks the active route in the
sidebar, the way a lane marks a road. Everything around it stays quiet. No gloss, no gradients.

Baseline throughout: responsive to mobile, visible keyboard focus, `prefers-reduced-motion`
respected (the admin's motion toggle can only ever reduce motion further, never force it on).
