import { Role } from '../enums/role.enum';

/** Functional grouping of permissions (used for the catalog UI and clarity). */
export type PermissionGroup =
  // Platform (SuperAdmin / Accountant)
  | 'PLATFORM_USER_SECURITY' | 'PLATFORM_OPERATOR' | 'PLATFORM_SUBSCRIPTION' | 'PLATFORM_BILLING'
  | 'PLATFORM_CONFIG' | 'PLATFORM_API' | 'PLATFORM_MARKETPLACE' | 'PLATFORM_COMPLIANCE'
  | 'PLATFORM_RELIABILITY' | 'PLATFORM_ANALYTICS'
  // Operator domain
  | 'OPERATOR_STAFF' | 'BUS' | 'ROUTE' | 'SCHEDULE' | 'TRIP' | 'SEAT_INVENTORY'
  | 'BOOKING' | 'TICKETING' | 'PASSENGER_TRANSFER' | 'SEAT_UPGRADE' | 'BOARDING'
  | 'PRICING' | 'REFUND' | 'SETTLEMENT' | 'OPERATOR_FINANCE'
  | 'DRIVER_COMPLIANCE' | 'FUEL' | 'FLEET_MAINTENANCE' | 'CREW_HR' | 'DISRUPTION' | 'FORECASTING'
  | 'SUPPORT_CRM' | 'TRACKING' | 'REPORTS' | 'AUDIT'
  | 'WORKFLOW' | 'HUB';

/** A single permission definition. The catalog of these is the single source of truth. */
export interface PermissionDef {
  key: string;
  label: string;
  group: PermissionGroup;
  roles: Role[]; // default roles granted this permission
}
