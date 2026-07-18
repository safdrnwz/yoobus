/** Pure, testable support & CRM lifecycle rules. */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }
export type TicketStatus = 'OPEN' | 'ASSIGNED' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';

const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['ASSIGNED', 'ESCALATED', 'CLOSED'],
  ASSIGNED: ['ESCALATED', 'RESOLVED', 'CLOSED'],
  ESCALATED: ['ASSIGNED', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'], // reopen
  CLOSED: ['OPEN'],             // reopen
};

export function ticketCanTransition(from: TicketStatus, to: TicketStatus): InvariantResult {
  if (!TICKET_TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'TICKET_INVALID_TRANSITION', message: `A ticket cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}
