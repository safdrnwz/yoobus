/**
 * Delete-permission rules (Phase: governance). Operator-admins may NEVER delete
 * users, bookings or financial transactions (government-retained records); they may
 * only deactivate/cancel. SuperAdmin may soft-delete operational resources but
 * financial/audit ledgers are append-only for everyone.
 */
export type ResourceType =
  | 'USER'
  | 'BOOKING'
  | 'PAYMENT'
  | 'COMMISSION'
  | 'INVOICE'
  | 'SETTLEMENT'
  | 'WALLET'
  | 'AUDIT'
  | 'BUS'
  | 'DRIVER'
  | 'ROUTE'
  | 'STOP'
  | 'TRIP'
  | 'CHANNEL'
  | 'OPERATOR';

const IMMUTABLE_FOR_EVERYONE: ResourceType[] = [
  'BOOKING',
  'PAYMENT',
  'COMMISSION',
  'INVOICE',
  'SETTLEMENT',
  'WALLET',
  'AUDIT',
];

const FORBIDDEN_FOR_OPERATOR: ResourceType[] = [...IMMUTABLE_FOR_EVERYONE, 'USER', 'OPERATOR'];

export function canDelete(role: string, resource: ResourceType): { ok: boolean; code?: string } {
  if (IMMUTABLE_FOR_EVERYONE.includes(resource)) {
    return { ok: false, code: 'RECORD_IMMUTABLE' };
  }
  if (role === 'SUPERADMIN') return { ok: true };
  if (role === 'OPERATOR_ADMIN') {
    if (FORBIDDEN_FOR_OPERATOR.includes(resource)) {
      return { ok: false, code: `DELETE_FORBIDDEN_${resource}` };
    }
    return { ok: true };
  }
  return { ok: false, code: 'DELETE_FORBIDDEN' };
}
