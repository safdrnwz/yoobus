/** Pure, testable passenger-transfer / bus-exchange rules. */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }

export type TransferStatus = 'INITIATED' | 'APPROVED' | 'EXECUTED' | 'CANCELLED';

const TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  INITIATED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['EXECUTED', 'CANCELLED'],
  EXECUTED: [],
  CANCELLED: [],
};

export function transferCanTransition(from: TransferStatus, to: TransferStatus): InvariantResult {
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'TRANSFER_INVALID_TRANSITION', message: `A transfer cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}

export function canInitiateTransfer(bookingStatus: string, fromTripId: string, toTripId: string): InvariantResult {
  if (bookingStatus !== 'CONFIRMED') return { ok: false, code: 'TRANSFER_BOOKING_NOT_CONFIRMED', message: 'Only a confirmed booking can be transferred.' };
  if (fromTripId === toTripId) return { ok: false, code: 'TRANSFER_SAME_TRIP', message: 'The target trip must be different from the current trip.' };
  return { ok: true };
}
