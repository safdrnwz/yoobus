import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, ArrowUpCircle, BadgeCheck, BarChart3, Bell, Boxes, Building2, Bus, CalendarClock, ClipboardCheck, Coins, Container, CreditCard, Database, FileText, Fuel, Gauge, Globe, HeartPulse, KeyRound, Landmark, LayoutDashboard, LayoutGrid, LifeBuoy, LineChart, MapPin, Megaphone, Package, Palette, PlugZap, QrCode, Receipt, Route as RouteIcon, ScrollText, Search, Settings, Shield, ShieldCheck, Split, Star, Store, Ticket, TrendingUp, Truck, UserCog, Users, Wallet, Wrench } from 'lucide-react';
import { Permission } from '@/core/rbac/permissions';
import { Role } from '@/core/rbac/roles';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Any one of these permissions reveals the item. Omit to show it to everyone signed in. */
  anyOf?: string[];
  /** Restricts the item to specific roles, on top of any permission check. */
  roles?: Role[];
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * The menu is data, not markup.
 *
 * Every item declares what it needs; the sidebar filters against the user's effective
 * permissions (fetched from the server) and hides whole sections that end up empty. A
 * driver and a SuperAdmin therefore see two completely different products from one config.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'Overview', to: '/platform/overview', icon: LayoutDashboard, roles: [Role.SUPERADMIN] },
      { label: 'Operators', to: '/platform/operators', icon: Building2, anyOf: [Permission.VIEW_OPERATOR] },
      { label: 'Applications', to: '/platform/applications', icon: BadgeCheck, roles: [Role.SUPERADMIN] },
      { label: 'SaaS billing', to: '/platform/saas-billing', icon: Receipt, anyOf: [Permission.VIEW_SAAS_LEDGER] },
      { label: 'Corporate accounts', to: '/platform/corporate', icon: Landmark, roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
      { label: 'API partners', to: '/platform/api-management', icon: PlugZap, anyOf: [Permission.VIEW_API_USAGE, Permission.CREATE_API_PARTNER] },
      { label: 'Compliance', to: '/platform/compliance', icon: ShieldCheck, anyOf: [Permission.VIEW_COMPLIANCE_DASHBOARD, Permission.PROCESS_DATA_ACCESS_REQUEST] },
      { label: 'Reliability', to: '/platform/reliability', icon: HeartPulse, anyOf: [Permission.VIEW_SYSTEM_HEALTH, Permission.VIEW_BACKGROUND_JOBS] },
      { label: 'Analytics', to: '/platform/analytics', icon: LineChart, anyOf: [Permission.VIEW_CROSS_OPERATOR_ANALYTICS, Permission.VIEW_EXECUTIVE_DASHBOARD] },
      { label: 'Audit log', to: '/platform/audit', icon: ScrollText, anyOf: [Permission.VIEW_PLATFORM_AUDIT_LOGS] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { label: 'Dashboard', to: '/operations/dashboard', icon: Gauge, roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.SUPPORT] },
      { label: 'Buses', to: '/operations/buses', icon: Bus, anyOf: [Permission.VIEW_BUS] },
      { label: 'Seat layouts', to: '/operations/layouts', icon: LayoutGrid, anyOf: [Permission.VIEW_BUS] },
      { label: 'Routes', to: '/operations/routes', icon: RouteIcon, anyOf: [Permission.VIEW_ROUTE] },
      { label: 'Stops', to: '/operations/stops', icon: MapPin, anyOf: [Permission.VIEW_ROUTE] },
      { label: 'Schedules', to: '/operations/schedules', icon: CalendarClock, anyOf: [Permission.VIEW_SCHEDULE] },
      { label: 'Trips', to: '/operations/trips', icon: Truck, anyOf: [Permission.VIEW_SCHEDULE, Permission.CREATE_TRIP] },
      { label: 'Drivers', to: '/operations/drivers', icon: UserCog, anyOf: [Permission.EDIT_DRIVER, Permission.CREATE_DRIVER] },
      { label: 'Hubs', to: '/operations/hubs', icon: Container, anyOf: [Permission.VIEW_HUB] },
      { label: 'Counters', to: '/operations/counters', icon: Store, anyOf: [Permission.VIEW_COUNTER] },
    ],
  },
  {
    id: 'booking',
    label: 'Bookings',
    items: [
      { label: 'Search & book', to: '/bookings/search', icon: Search, anyOf: [Permission.SEARCH_BUSES] },
      { label: 'All bookings', to: '/bookings', icon: Ticket, anyOf: [Permission.VIEW_BOOKING, Permission.SEARCH_BOOKING] },
      { label: 'Seat upgrades', to: '/bookings/seat-upgrades', icon: ArrowUpCircle, anyOf: [Permission.OFFER_SEAT_UPGRADE] },
      { label: 'Transfers', to: '/bookings/transfers', icon: Split, anyOf: [Permission.INITIATE_PASSENGER_TRANSFER] },
      { label: 'Reviews', to: '/bookings/reviews', icon: Star, roles: [Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT, Role.ACCOUNTANT] },
    ],
  },
  {
    id: 'fleetcare',
    label: 'Fleet care',
    items: [
      { label: 'Maintenance', to: '/fleet/work-orders', icon: Wrench, anyOf: [Permission.CREATE_WORK_ORDER, Permission.VIEW_VEHICLE_HEALTH] },
      { label: 'Fuel', to: '/fleet/fuel', icon: Fuel, anyOf: [Permission.VIEW_FUEL_REPORTS, Permission.CREATE_FUEL_TXN] },
      { label: 'Driver compliance', to: '/fleet/driver-compliance', icon: Shield, anyOf: [Permission.VIEW_DRIVER_COMPLIANCE_DASHBOARD] },
      { label: 'Crew & HR', to: '/fleet/crew', icon: Users, anyOf: [Permission.CREATE_EMPLOYEE, Permission.MANAGE_SHIFT] },
      { label: 'Disruption', to: '/fleet/disruption', icon: AlertTriangle, anyOf: [Permission.VIEW_DISRUPTION_DASHBOARD, Permission.CREATE_DISRUPTION] },
      { label: 'Forecasting', to: '/fleet/forecasting', icon: TrendingUp, anyOf: [Permission.VIEW_FORECAST_DASHBOARD] },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { label: 'Summary', to: '/finance/summary', icon: BarChart3, anyOf: [Permission.VIEW_FINANCIAL_DASHBOARD, Permission.VIEW_REVENUE_REPORTS] },
      { label: 'Coupons', to: '/finance/coupons', icon: Megaphone, anyOf: [Permission.VIEW_COUPON] },
      { label: 'Settlements', to: '/finance/settlements', icon: Wallet, anyOf: [Permission.VIEW_SETTLEMENT_REPORTS, Permission.CREATE_SETTLEMENT] },
      { label: 'Invoices', to: '/finance/billing', icon: FileText, anyOf: [Permission.VIEW_LEDGER, Permission.VIEW_FINANCIAL_DASHBOARD] },
      { label: 'Ledger', to: '/finance/ledger', icon: Database, anyOf: [Permission.VIEW_LEDGER] },
      { label: 'Reports', to: '/finance/reports', icon: FileText, anyOf: [Permission.VIEW_GST_REPORTS, Permission.VIEW_REVENUE_REPORTS, Permission.VIEW_OCCUPANCY_REPORT] },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { label: 'Tickets', to: '/support/tickets', icon: LifeBuoy, anyOf: [Permission.VIEW_SUPPORT_TICKETS] },
      { label: 'Complaints', to: '/support/complaints', icon: Megaphone, anyOf: [Permission.VIEW_SUPPORT_TICKETS] },
      { label: 'Lost & found', to: '/support/lost-found', icon: Boxes, anyOf: [Permission.MANAGE_LOST_FOUND] },
      { label: 'Blacklist', to: '/support/blacklist', icon: Shield, anyOf: [Permission.BLACKLIST_PASSENGER] },
      { label: 'Notifications', to: '/support/notifications', icon: Bell, roles: [Role.OPERATOR_ADMIN, Role.SUPPORT] },
    ],
  },
  {
    id: 'driver',
    label: 'Driver',
    items: [
      { label: 'Boarding', to: '/driver/boarding', icon: QrCode, anyOf: [Permission.VIEW_BOARDING_LIST] },
      { label: 'Live tracking', to: '/driver/tracking', icon: Activity, anyOf: [Permission.VIEW_LIVE_TRACKING] },
    ],
  },
  {
    id: 'travel',
    label: 'My travel',
    items: [
      { label: 'Book a trip', to: '/travel/search', icon: Search, roles: [Role.CUSTOMER] },
      { label: 'My trips', to: '/travel/trips', icon: Ticket, roles: [Role.CUSTOMER] },
      { label: 'Wallet', to: '/travel/wallet', icon: Wallet, roles: [Role.CUSTOMER] },
      { label: 'Rewards', to: '/travel/loyalty', icon: Star, roles: [Role.CUSTOMER] },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { label: 'Audit trail', to: '/platform/audit', icon: ScrollText, anyOf: [Permission.VIEW_AUDIT_LOGS] },
      // Global Settings is SuperAdmin-only, and the backend enforces that independently.
      { label: 'Global settings', to: '/settings/appearance', icon: Palette, anyOf: [Permission.CONFIGURE_PLATFORM_SETTINGS] },
      { label: 'GPS Integration', to: '/settings/gps', icon: MapPin, anyOf: [Permission.CONFIGURE_GPS, Permission.MANAGE_GPS_PROVIDER] },
      { label: 'Platform settings', to: '/settings/platform', icon: Settings, anyOf: [Permission.CONFIGURE_PLATFORM_SETTINGS] },
      { label: 'Feature flags', to: '/settings/flags', icon: PlugZap, anyOf: [Permission.CONFIGURE_FEATURE_FLAGS] },
      { label: 'Maintenance', to: '/settings/maintenance', icon: Settings, anyOf: [Permission.CONFIGURE_MAINTENANCE_WINDOW, Permission.ENABLE_MAINTENANCE_MODE] },
      { label: 'Staff', to: '/settings/staff', icon: Users, anyOf: [Permission.VIEW_STAFF_LIST, Permission.CREATE_OPERATOR_STAFF, Permission.CREATE_PLATFORM_USER] },
      { label: 'Roles & permissions', to: '/settings/permissions', icon: KeyRound, anyOf: [Permission.CONFIGURE_STAFF_PERMISSIONS, Permission.ASSIGN_ROLE] },
      // Enterprise only. The screen says so itself rather than being hidden — an operator who
      // cannot find the feature cannot decide to pay for it.
      { label: 'Custom roles', to: '/settings/custom-roles', icon: Shield, roles: [Role.OPERATOR_ADMIN] },
      { label: 'Sales channels', to: '/settings/channels', icon: CreditCard, roles: [Role.OPERATOR_ADMIN, Role.SUPPORT] },
    ],
  },
];
