/**
 * THE single home for cross-cutting access rules that depend on the runtime resource
 * (operator isolation and personal ownership). Declarative role-gating stays on controllers
 * via @Roles + RolesGuard; this util holds the data-dependent checks that previously were
 * copy-pasted into several services. One rule, one place.
 */
import { Role } from '../enums/role.enum';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

/**
 * Operator isolation. SUPERADMIN (platform) may act across every operator; any other role
 * may only act within its own operator. Used wherever a non-platform actor touches an
 * operator-scoped resource.
 */
export function assertOperatorScope(
  role: Role | string,
  actorOperatorId: string | null | undefined,
  resourceOperatorId: string | null | undefined,
): InvariantResult {
  if (role === Role.SUPERADMIN) return { ok: true };
  if (actorOperatorId && resourceOperatorId && actorOperatorId === resourceOperatorId) return { ok: true };
  return { ok: false, code: 'CROSS_OPERATOR_FORBIDDEN', message: 'This resource does not belong to your operator.' };
}

/**
 * Personal ownership. A passenger (USER) may only act on a resource they own; staff,
 * operator-admin, and platform roles are not constrained by this particular rule
 * (their access is governed by @Roles and operator scope instead).
 */
export function assertResourceOwner(
  role: Role | string,
  actorUserId: string,
  resourceUserId: string,
): InvariantResult {
  if (role !== Role.CUSTOMER) return { ok: true };
  if (actorUserId === resourceUserId) return { ok: true };
  return { ok: false, code: 'NOT_YOUR_RESOURCE', message: 'This resource does not belong to you.' };
}
