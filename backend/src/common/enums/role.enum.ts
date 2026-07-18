/**
 * The complete set of roles in Yoo Bus.
 *
 * There are TWO layers, and confusing them is how access-control bugs are born.
 *
 *  1. PLATFORM — Yoo Bus itself, the SaaS. operatorId is ALWAYS null. These people run the
 *     business: they onboard operators, bill them, and support them.
 *
 *       SUPERADMIN        owns the platform — operators, global settings, everything
 *       ACCOUNTANT        platform finance — SaaS billing, operator invoices, settlements
 *       PLATFORM_SUPPORT  Yoo Bus's own support desk — works ACROSS every operator
 *
 *  2. OPERATOR — a bus company onboarded onto Yoo Bus. operatorId is REQUIRED, and these
 *     people only ever see their own operator's data.
 *
 *       OPERATOR_ADMIN    runs one operator; adds that operator's own staff
 *       SUPPORT           that operator's support desk — its own tickets only
 *       DRIVER            that operator's driver
 *
 *  And the passenger, who belongs to no operator:
 *
 *       CUSTOMER          platform-global passenger (operatorId = null)
 *
 * The chain is: SuperAdmin adds an Operator -> that Operator's admin adds its own staff.
 */
export enum Role {
  // ---- Layer 1: Yoo Bus platform staff (operatorId = null) ----
  SUPERADMIN = 'SUPERADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  PLATFORM_SUPPORT = 'PLATFORM_SUPPORT',

  // ---- Layer 2: operator staff (operatorId required) ----
  OPERATOR_ADMIN = 'OPERATOR_ADMIN',
  // Optional operator staff the OPERATOR_ADMIN can add as the business grows (add-on).
  // Each logs in with their own credentials and sees ONLY their scoped functionality.
  OPERATIONS_MANAGER = 'OPERATIONS_MANAGER',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  DEPOT_MANAGER = 'DEPOT_MANAGER',
  CREW = 'CREW',
  SUPPORT = 'SUPPORT',
  DRIVER = 'DRIVER',

  // ---- Passenger ----
  CUSTOMER = 'CUSTOMER',
}

/** Platform-level roles. operatorId MUST be null. */
export const PLATFORM_ROLES = [Role.SUPERADMIN, Role.ACCOUNTANT, Role.PLATFORM_SUPPORT];

/** Operator-scoped staff roles. operatorId is MANDATORY. */
export const OPERATOR_STAFF_ROLES = [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER, Role.DEPOT_MANAGER, Role.CREW, Role.SUPPORT, Role.DRIVER];

/** Yoo Bus's own staff, created by the SuperAdmin from the platform Users screen. */
export const PLATFORM_CREATABLE_ROLES = [Role.ACCOUNTANT, Role.PLATFORM_SUPPORT];

/** Roles an operator admin may create inside their OWN operator. */
// Roles an OPERATOR_ADMIN may create inside their OWN operator. Adding OM/FN/DM/CREW is
// optional — the operator admin holds all of these powers themselves and only delegates when
// they choose to (the "add-on" model).
export const OPERATOR_CREATABLE_ROLES = [
  Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER, Role.DEPOT_MANAGER, Role.CREW, Role.SUPPORT, Role.DRIVER,
];

/** Both support desks. PLATFORM_SUPPORT sees every operator; SUPPORT sees only its own. */
export const SUPPORT_ROLES = [Role.PLATFORM_SUPPORT, Role.SUPPORT];

/** True when the role sits above every operator (no operator scoping applies). */
export function isPlatformRole(role: Role): boolean {
  return PLATFORM_ROLES.includes(role);
}
