import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PublicSearchLayout } from '@/components/layout/PublicSearchLayout';
import { Spinner } from '@/components/ui';
import { Permission } from '@/core/rbac/permissions';
import { Role } from '@/core/rbac/roles';
import { isAppHost } from '@/core/env/host';
import { NotFound, RequireAccess, RequireAnonymous, RequireAuth, RoleHomeRedirect } from './guards';

/* Every screen is code-split. A driver's phone never downloads the SaaS billing screens. */

const SignInPage = lazy(() => import('@/features/auth/pages/SignInPage').then((m) => ({ default: m.SignInPage })));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const OperatorApplyPage = lazy(() =>
  import('@/features/onboarding/pages/OperatorApplyPage').then((m) => ({ default: m.OperatorApplyPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);

const AppearanceSettingsPage = lazy(() =>
  import('@/features/settings/pages/AppearanceSettingsPage').then((m) => ({ default: m.AppearanceSettingsPage })),
);
const PlatformSettingsPage = lazy(() =>
  import('@/features/settings/pages/PlatformSettingsPage').then((m) => ({ default: m.PlatformSettingsPage })),
);

const dashboards = () => import('@/features/dashboard/pages/DashboardPages');
const platform = () => import('@/features/platform/pages/PlatformPages');
const operations = () => import('@/features/operations/pages/OperationsPages');
const seatLayouts = () => import('@/features/operations/pages/SeatLayoutPages');
const bookings = () => import('@/features/booking/pages/BookingPages');
const fleet = () => import('@/features/fleet/pages/FleetPages');
const finance = () => import('@/features/finance/pages/FinancePages');
const reports = () => import('@/features/finance/pages/ReportsPage');
const support = () => import('@/features/support/pages/SupportPages');
const admin = () => import('@/features/settings/pages/AdminPages');
const customRoles = () => import('@/features/settings/pages/CustomRolesPage');
const gps = () => import('@/features/settings/pages/GpsIntegrationPage');
const account = () => import('@/features/account/pages/AccountPages');
const travel = () => import('@/features/travel/pages/TravelPages');
const boarding = () => import('@/features/driver/pages/BoardingPage');
const tracking = () => import('@/features/driver/pages/LiveTrackingPage');

/** Turns a named export in a shared module into a lazy route element. */
function page<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M) {
  const Component = lazy(() => loader().then((module) => ({ default: module[name] as React.ComponentType })));
  return <Component />;
}

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-5 w-5" />
    </div>
  );
}

/** Wraps a route in its access rules. Roles and permissions are checked before it renders. */
function gate(element: ReactNode, access?: { roles?: Role[]; anyOf?: string[] }) {
  const inner = access ? <RequireAccess {...access}>{element}</RequireAccess> : element;
  return <Suspense fallback={<Loading />}>{inner}</Suspense>;
}

// ---- shared unauthenticated routes ----
const signIn: RouteObject = {
  path: '/sign-in',
  element: (
    <RequireAnonymous>
      <Suspense fallback={<Loading />}>
        <SignInPage />
      </Suspense>
    </RequireAnonymous>
  ),
};
const forgotPassword: RouteObject = {
  path: '/forgot-password',
  element: (
    <RequireAnonymous>
      <Suspense fallback={<Loading />}>
        <ForgotPasswordPage />
      </Suspense>
    </RequireAnonymous>
  ),
};
const publicSearch: RouteObject = {
  element: (
    <Suspense fallback={<Loading />}>
      <PublicSearchLayout />
    </Suspense>
  ),
  children: [{ index: true, element: page(bookings, 'JourneySearchPage') }],
};

/* ==================================================================================
 * CUSTOMER SITE  —  yoobus.com  (dev: localhost)
 * Search & book tickets. A guest lands straight on search; sign-in is asked for only
 * when a seat is actually held.
 * ================================================================================== */
const customerRoutes: RouteObject[] = [
  signIn,
  {
    path: '/register',
    element: (
      <RequireAnonymous>
        <Suspense fallback={<Loading />}>
          <RegisterPage />
        </Suspense>
      </RequireAnonymous>
    ),
  },
  forgotPassword,
  {
    // Public "Become an Operator" application — one form, no login.
    path: '/become-an-operator',
    element: (
      <Suspense fallback={<Loading />}>
        <OperatorApplyPage />
      </Suspense>
    ),
  },
  // Public landing = search (a guest can browse buses and pick seats without an account).
  { path: '/', ...publicSearch },
  { path: '/search', ...publicSearch },
  // Authenticated passenger area.
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: 'travel/search', element: gate(page(bookings, 'JourneySearchPage'), { roles: [Role.CUSTOMER] }) },
      { path: 'travel/trips', element: gate(page(bookings, 'MyTripsPage'), { roles: [Role.CUSTOMER] }) },
      { path: 'travel/wallet', element: gate(page(travel, 'WalletPage'), { roles: [Role.CUSTOMER] }) },
      { path: 'travel/loyalty', element: gate(page(travel, 'LoyaltyPage'), { roles: [Role.CUSTOMER] }) },
      { path: 'account', element: gate(page(account, 'AccountPage')) },
      { path: 'account/security', element: gate(page(account, 'SecurityPage')) },
    ],
  },
  { path: '*', element: <NotFound /> },
];

/* ==================================================================================
 * STAFF CONSOLE  —  app.yoobus.com  (dev: app.localhost)
 * SuperAdmin, Operator Admin, and all operator staff.
 * ================================================================================== */
const appRoutes: RouteObject[] = [
  signIn,
  forgotPassword,
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <RoleHomeRedirect /> },

      // Platform
      { path: 'platform/overview', element: gate(page(dashboards, 'PlatformOverviewPage'), { roles: [Role.SUPERADMIN] }) },
      { path: 'platform/operators', element: gate(page(platform, 'OperatorsPage'), { roles: [Role.SUPERADMIN] }) },
      { path: 'platform/applications', element: gate(page(platform, 'OperatorLeadsPage'), { roles: [Role.SUPERADMIN] }) },
      { path: 'platform/saas-billing', element: gate(page(platform, 'SaasBillingPage'), { anyOf: [Permission.VIEW_SAAS_LEDGER] }) },
      { path: 'platform/corporate', element: gate(page(platform, 'CorporatePage'), { roles: [Role.SUPERADMIN, Role.ACCOUNTANT] }) },
      { path: 'platform/api-management', element: gate(page(platform, 'ApiPartnersPage'), { anyOf: [Permission.VIEW_API_USAGE, Permission.CREATE_API_PARTNER] }) },
      { path: 'platform/compliance', element: gate(page(platform, 'CompliancePage'), { anyOf: [Permission.VIEW_COMPLIANCE_DASHBOARD, Permission.PROCESS_DATA_ACCESS_REQUEST] }) },
      { path: 'platform/reliability', element: gate(page(platform, 'ReliabilityPage'), { anyOf: [Permission.VIEW_SYSTEM_HEALTH, Permission.VIEW_BACKGROUND_JOBS] }) },
      { path: 'platform/analytics', element: gate(page(dashboards, 'PlatformOverviewPage'), { anyOf: [Permission.VIEW_CROSS_OPERATOR_ANALYTICS, Permission.VIEW_EXECUTIVE_DASHBOARD] }) },
      { path: 'platform/audit', element: gate(page(platform, 'AuditPage'), { anyOf: [Permission.VIEW_AUDIT_LOGS, Permission.VIEW_PLATFORM_AUDIT_LOGS] }) },

      // Operations
      { path: 'operations/dashboard', element: gate(page(dashboards, 'OperatorDashboardPage'), { roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.SUPPORT] }) },
      { path: 'operations/buses', element: gate(page(operations, 'BusesPage'), { anyOf: [Permission.VIEW_BUS] }) },
      { path: 'operations/layouts', element: gate(page(seatLayouts, 'SeatLayoutsPage'), { anyOf: [Permission.VIEW_BUS] }) },
      { path: 'operations/layouts/:id', element: gate(page(seatLayouts, 'SeatLayoutBuilderPage'), { anyOf: [Permission.VIEW_BUS] }) },
      { path: 'operations/routes', element: gate(page(operations, 'RoutesPage'), { anyOf: [Permission.VIEW_ROUTE] }) },
      { path: 'operations/stops', element: gate(page(operations, 'StopsPage'), { anyOf: [Permission.VIEW_ROUTE] }) },
      { path: 'operations/stops/new', element: gate(page(operations, 'NewStopPage'), { anyOf: [Permission.MANAGE_ROUTE_STOPS] }) },
      { path: 'operations/schedules', element: gate(page(operations, 'SchedulesPage'), { anyOf: [Permission.VIEW_SCHEDULE] }) },
      { path: 'operations/trips', element: gate(page(operations, 'SchedulesPage'), { anyOf: [Permission.VIEW_SCHEDULE, Permission.CREATE_TRIP] }) },
      { path: 'operations/drivers', element: gate(page(operations, 'DriversPage'), { anyOf: [Permission.EDIT_DRIVER, Permission.CREATE_DRIVER] }) },
      { path: 'operations/hubs', element: gate(page(operations, 'HubsPage'), { anyOf: [Permission.VIEW_HUB] }) },
      { path: 'operations/counters', element: gate(page(operations, 'CountersPage'), { anyOf: [Permission.VIEW_COUNTER] }) },

      // Bookings (operator/staff management)
      { path: 'bookings', element: gate(page(bookings, 'BookingsPage'), { anyOf: [Permission.VIEW_BOOKING, Permission.SEARCH_BOOKING] }) },
      { path: 'bookings/search', element: gate(page(bookings, 'JourneySearchPage'), { anyOf: [Permission.SEARCH_BUSES] }) },
      { path: 'bookings/seat-upgrades', element: gate(page(bookings, 'BookingsPage'), { anyOf: [Permission.OFFER_SEAT_UPGRADE] }) },
      { path: 'bookings/transfers', element: gate(page(bookings, 'BookingsPage'), { anyOf: [Permission.INITIATE_PASSENGER_TRANSFER] }) },
      { path: 'bookings/reviews', element: gate(page(bookings, 'BookingsPage'), { roles: [Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT, Role.ACCOUNTANT] }) },

      // Fleet care
      { path: 'fleet/work-orders', element: gate(page(fleet, 'WorkOrdersPage'), { anyOf: [Permission.CREATE_WORK_ORDER, Permission.VIEW_VEHICLE_HEALTH] }) },
      { path: 'fleet/fuel', element: gate(page(fleet, 'FuelPage'), { anyOf: [Permission.VIEW_FUEL_REPORTS, Permission.CREATE_FUEL_TXN] }) },
      { path: 'fleet/driver-compliance', element: gate(page(fleet, 'DriverCompliancePage'), { anyOf: [Permission.VIEW_DRIVER_COMPLIANCE_DASHBOARD] }) },
      { path: 'fleet/crew', element: gate(page(fleet, 'CrewPage'), { anyOf: [Permission.CREATE_EMPLOYEE, Permission.MANAGE_SHIFT] }) },
      { path: 'fleet/disruption', element: gate(page(fleet, 'DisruptionPage'), { anyOf: [Permission.VIEW_DISRUPTION_DASHBOARD, Permission.CREATE_DISRUPTION] }) },
      { path: 'fleet/forecasting', element: gate(page(fleet, 'ForecastingPage'), { anyOf: [Permission.VIEW_FORECAST_DASHBOARD] }) },

      // Finance
      { path: 'finance/summary', element: gate(page(reports, 'FinanceSummaryPage'), { anyOf: [Permission.VIEW_FINANCIAL_DASHBOARD, Permission.VIEW_REVENUE_REPORTS] }) },
      { path: 'finance/coupons', element: gate(page(finance, 'CouponsPage'), { anyOf: [Permission.VIEW_COUPON] }) },
      { path: 'finance/coupons/new', element: gate(page(finance, 'NewCouponPage'), { anyOf: [Permission.MANAGE_COUPON] }) },
      { path: 'finance/settlements', element: gate(page(finance, 'SettlementsPage'), { anyOf: [Permission.VIEW_SETTLEMENT_REPORTS, Permission.CREATE_SETTLEMENT] }) },
      { path: 'finance/settlements/new', element: gate(page(finance, 'NewSettlementPage'), { anyOf: [Permission.CREATE_SETTLEMENT] }) },
      { path: 'finance/billing', element: gate(page(finance, 'InvoicesPage'), { anyOf: [Permission.VIEW_LEDGER, Permission.VIEW_FINANCIAL_DASHBOARD] }) },
      { path: 'finance/ledger', element: gate(page(finance, 'LedgerPage'), { anyOf: [Permission.VIEW_LEDGER] }) },
      { path: 'finance/ledger/new', element: gate(page(finance, 'NewJournalPage'), { anyOf: [Permission.VIEW_LEDGER] }) },
      { path: 'finance/reports', element: gate(page(reports, 'ReportsPage'), { anyOf: [Permission.VIEW_GST_REPORTS, Permission.VIEW_REVENUE_REPORTS, Permission.VIEW_OCCUPANCY_REPORT] }) },

      // Support
      { path: 'support/tickets', element: gate(page(support, 'TicketsPage'), { anyOf: [Permission.VIEW_SUPPORT_TICKETS] }) },
      { path: 'support/complaints', element: gate(page(support, 'ComplaintsPage'), { anyOf: [Permission.VIEW_SUPPORT_TICKETS] }) },
      { path: 'support/lost-found', element: gate(page(support, 'LostFoundPage'), { anyOf: [Permission.MANAGE_LOST_FOUND] }) },
      { path: 'support/blacklist', element: gate(page(support, 'BlacklistPage'), { anyOf: [Permission.BLACKLIST_PASSENGER] }) },
      { path: 'support/notifications', element: gate(page(support, 'NotificationsPage')) },

      // Driver / crew
      { path: 'driver/boarding', element: gate(page(boarding, 'BoardingPage'), { anyOf: [Permission.VIEW_BOARDING_LIST] }) },
      { path: 'driver/tracking', element: gate(page(tracking, 'LiveTrackingPage'), { anyOf: [Permission.VIEW_LIVE_TRACKING] }) },

      // Administration
      {
        path: 'settings/appearance',
        element: gate(<AppearanceSettingsPage />, { anyOf: [Permission.CONFIGURE_PLATFORM_SETTINGS] }),
      },
      {
        path: 'settings/platform',
        element: gate(<PlatformSettingsPage />, { anyOf: [Permission.CONFIGURE_PLATFORM_SETTINGS] }),
      },
      { path: 'settings/flags', element: gate(page(admin, 'FeatureFlagsPage'), { anyOf: [Permission.CONFIGURE_FEATURE_FLAGS] }) },
      { path: 'settings/maintenance', element: gate(page(admin, 'MaintenancePage'), { anyOf: [Permission.CONFIGURE_MAINTENANCE_WINDOW, Permission.ENABLE_MAINTENANCE_MODE] }) },
      { path: 'settings/staff', element: gate(page(admin, 'StaffPage'), { anyOf: [Permission.VIEW_STAFF_LIST, Permission.CREATE_OPERATOR_STAFF, Permission.CREATE_PLATFORM_USER] }) },
      { path: 'settings/permissions', element: gate(page(admin, 'PermissionsPage'), { anyOf: [Permission.CONFIGURE_STAFF_PERMISSIONS, Permission.ASSIGN_ROLE] }) },
      { path: 'settings/custom-roles', element: gate(page(customRoles, 'CustomRolesPage'), { roles: [Role.OPERATOR_ADMIN] }) },
      { path: 'settings/gps', element: gate(page(gps, 'GpsIntegrationPage'), { anyOf: [Permission.CONFIGURE_GPS, Permission.MANAGE_GPS_PROVIDER] }) },
      { path: 'settings/channels', element: gate(page(admin, 'ChannelsPage'), { roles: [Role.OPERATOR_ADMIN, Role.SUPPORT] }) },

      // Account
      { path: 'account', element: gate(page(account, 'AccountPage')) },
      { path: 'account/security', element: gate(page(account, 'SecurityPage')) },

      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(isAppHost() ? appRoutes : customerRoutes);
