/**
 * Mirrors the backend Role enum (backend/src/common/enums/role.enum.ts).
 *
 * Two layers:
 *   PLATFORM (Yoo Bus itself, operatorId = null) — SUPERADMIN, ACCOUNTANT, PLATFORM_SUPPORT
 *   OPERATOR (a bus company on Yoo Bus)          — OPERATOR_ADMIN, SUPPORT, DRIVER
 *   plus CUSTOMER, the passenger.
 */
export const Role = {
  // Platform — Yoo Bus's own staff
  SUPERADMIN: 'SUPERADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',
  // Operator staff
  OPERATOR_ADMIN: 'OPERATOR_ADMIN',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  DEPOT_MANAGER: 'DEPOT_MANAGER',
  CREW: 'CREW',
  SUPPORT: 'SUPPORT',
  DRIVER: 'DRIVER',
  // Passenger
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Platform roles carry no operatorId — they sit above every operator. */
export const PLATFORM_ROLES: Role[] = [Role.SUPERADMIN, Role.ACCOUNTANT, Role.PLATFORM_SUPPORT];
/** Operator staff always belong to exactly one operator. */
export const OPERATOR_STAFF_ROLES: Role[] = [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER, Role.DEPOT_MANAGER, Role.CREW, Role.SUPPORT, Role.DRIVER];
/** What the SuperAdmin may create at platform level (Yoo Bus's own team). */
export const PLATFORM_CREATABLE_ROLES: Role[] = [Role.ACCOUNTANT, Role.PLATFORM_SUPPORT];
/** What an operator admin may create inside their own operator. */
export const OPERATOR_CREATABLE_ROLES: Role[] = [Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER, Role.DEPOT_MANAGER, Role.CREW, Role.SUPPORT, Role.DRIVER];

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Platform SuperAdmin',
  ACCOUNTANT: 'Platform Accountant',
  PLATFORM_SUPPORT: 'Platform Support',
  OPERATOR_ADMIN: 'Operator Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  FINANCE_MANAGER: 'Finance Manager',
  DEPOT_MANAGER: 'Depot Manager',
  CREW: 'Crew',
  SUPPORT: 'Operator Support',
  DRIVER: 'Driver',
  CUSTOMER: 'Passenger',
};

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  SUPERADMIN: '/platform/overview',
  ACCOUNTANT: '/platform/saas-billing',
  PLATFORM_SUPPORT: '/support/tickets',
  OPERATOR_ADMIN: '/operations/dashboard',
  OPERATIONS_MANAGER: '/operations/dashboard',
  FINANCE_MANAGER: '/finance/dashboard',
  DEPOT_MANAGER: '/fleet/buses',
  CREW: '/driver/boarding',
  SUPPORT: '/support/tickets',
  DRIVER: '/driver/boarding',
  CUSTOMER: '/travel/trips',
};

export function isPlatformRole(role: Role): boolean {
  return PLATFORM_ROLES.includes(role);
}
