/**
 * Pure, testable lifecycle for fleet maintenance work orders.
 */
export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export function workOrderCanTransition(from: WorkOrderStatus, to: WorkOrderStatus): InvariantResult {
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'WORK_ORDER_INVALID_TRANSITION', message: `A work order cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}
