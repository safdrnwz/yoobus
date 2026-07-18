// Pure invariant validators. Each function returns an error code or null.
// Services call these; there is no database access here, only decision logic.

export type InvariantResult = { ok: true } | { ok: false; code: string; message: string };

const OK: InvariantResult = { ok: true };
function fail(code: string, message: string): InvariantResult {
  return { ok: false, code, message };
}

// ---- Operator dedupe ----
export interface OperatorIdentity {
  gstin?: string | null;
  pan?: string | null;
  legalName: string;
  email: string;
  mobile: string;
}

export function checkOperatorDuplicate(
  candidate: OperatorIdentity,
  existing: OperatorIdentity[],
): InvariantResult {
  const norm = (s?: string | null) => (s || '').trim().toLowerCase();
  for (const e of existing) {
    if (candidate.gstin && norm(candidate.gstin) === norm(e.gstin))
      return fail('OPERATOR_DUPLICATE_GSTIN', 'An operator is already registered with this GSTIN');
    if (candidate.pan && norm(candidate.pan) === norm(e.pan))
      return fail('OPERATOR_DUPLICATE_PAN', 'An operator is already registered with this PAN');
    if (norm(candidate.email) === norm(e.email))
      return fail('OPERATOR_DUPLICATE_EMAIL', 'An operator is already registered with this email');
    if (norm(candidate.mobile) === norm(e.mobile))
      return fail('OPERATOR_DUPLICATE_MOBILE', 'An operator is already registered with this mobile');
    if (norm(candidate.legalName) === norm(e.legalName))
      return fail('OPERATOR_DUPLICATE_NAME', 'An operator is already registered with this legal name');
  }
  return OK;
}

// ---- Bus reg globally unique (ek bus -> ek operator) ----
export function checkBusRegUnique(
  registrationNumber: string,
  existingRegs: string[],
): InvariantResult {
  const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');
  const target = norm(registrationNumber);
  if (existingRegs.some((r) => norm(r) === target))
    return fail('BUS_REG_DUPLICATE', 'This registration number already exists (one bus belongs to exactly one operator)');
  return OK;
}

// ---- Driver 1:1 bus + same operator ----
export interface DriverAssignmentCtx {
  driverOperatorId: string;
  busOperatorId: string;
  driverCurrentBusId: string | null; // driver already kisi bus pe?
  busCurrentDriverId: string | null; // Does the bus already have a driver?
  requestedBusId: string;
  driverId: string;
}

export function checkDriverBusAssignment(ctx: DriverAssignmentCtx): InvariantResult {
  if (ctx.driverOperatorId !== ctx.busOperatorId)
    return fail('CROSS_OPERATOR_DRIVER_BUS', 'Driver and bus belong to different operators — assignment not allowed');
  if (ctx.driverCurrentBusId && ctx.driverCurrentBusId !== ctx.requestedBusId)
    return fail('DRIVER_ALREADY_ASSIGNED', 'This driver is already assigned to another bus (one driver per bus)');
  if (ctx.busCurrentDriverId && ctx.busCurrentDriverId !== ctx.driverId)
    return fail('BUS_ALREADY_HAS_DRIVER', 'This bus already has a driver assigned');
  return OK;
}

// ---- One bus -> one active route ----
export function checkBusRouteForTrip(
  busMappedRouteId: string | null,
  tripRouteId: string,
): InvariantResult {
  if (!busMappedRouteId)
    return fail('BUS_NOT_MAPPED', 'This bus is not mapped to any route — assign a route first');
  if (busMappedRouteId !== tripRouteId)
    return fail('BUS_ROUTE_MISMATCH', 'Bus is not mapped to this route — change the route first');
  return OK;
}

export function checkRouteChangeAllowed(
  pendingUpcomingTrips: number,
): InvariantResult {
  if (pendingUpcomingTrips > 0)
    return fail('ROUTE_CHANGE_BLOCKED', 'Complete or cancel upcoming trips of this bus before changing the route');
  return OK;
}

// ---- Operator isolation: may the actor access the target operator's data? ----
export function checkOperatorAccess(
  actorRole: string,
  actorOperatorId: string | null,
  targetOperatorId: string,
): InvariantResult {
  if (actorRole === 'SUPERADMIN') return OK; // platform cross-operator
  if (actorOperatorId && actorOperatorId === targetOperatorId) return OK;
  return fail('CROSS_OPERATOR_FORBIDDEN', 'You cannot access data of another operator');
}
