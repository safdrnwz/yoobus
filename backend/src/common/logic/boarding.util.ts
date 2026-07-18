/** Pure, testable boarding & QR-validation rules. */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }

const TICKET_PREFIX = 'TICKET:';

/** Extracts the PNR from a scanned ticket QR payload, or null if malformed. */
export function parseTicketToken(payload: string): string | null {
  if (typeof payload !== 'string' || !payload.startsWith(TICKET_PREFIX)) return null;
  const pnr = payload.slice(TICKET_PREFIX.length).trim();
  return pnr.length > 0 ? pnr : null;
}

/** A passenger can board only on a confirmed booking that has not already been boarded. */
export function canBoard(bookingStatus: string, alreadyRecorded: boolean): InvariantResult {
  if (bookingStatus !== 'CONFIRMED') return { ok: false, code: 'BOARDING_NOT_CONFIRMED', message: 'This ticket is not a confirmed booking.' };
  if (alreadyRecorded) return { ok: false, code: 'BOARDING_ALREADY_RECORDED', message: 'This ticket has already been processed at boarding.' };
  return { ok: true };
}
