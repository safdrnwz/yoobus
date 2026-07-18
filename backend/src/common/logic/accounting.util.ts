/**
 * Pure, testable double-entry accounting rules. This is a distinct ledger layer; it does
 * not duplicate the billing/settlement modules (which handle invoices and payouts).
 */
export interface JournalLine { account: string; debit: number; credit: number; }
export interface InvariantResult { ok: boolean; code?: string; message?: string; }

function round2(n: number): number { return Math.round(n * 100) / 100; }

export function totalDebits(lines: JournalLine[]): number {
  return round2(lines.reduce((s, l) => s + (l.debit || 0), 0));
}
export function totalCredits(lines: JournalLine[]): number {
  return round2(lines.reduce((s, l) => s + (l.credit || 0), 0));
}

/** A journal entry is valid only when total debits equal total credits and are non-zero. */
export function isBalanced(lines: JournalLine[]): boolean {
  const d = totalDebits(lines);
  const c = totalCredits(lines);
  return d > 0 && d === c;
}

export function validateJournal(lines: JournalLine[]): InvariantResult {
  if (!Array.isArray(lines) || lines.length < 2) {
    return { ok: false, code: 'JOURNAL_TOO_FEW_LINES', message: 'A journal entry needs at least two lines.' };
  }
  for (const l of lines) {
    if ((l.debit || 0) < 0 || (l.credit || 0) < 0) return { ok: false, code: 'JOURNAL_NEGATIVE', message: 'Debit and credit amounts cannot be negative.' };
    if ((l.debit || 0) > 0 && (l.credit || 0) > 0) return { ok: false, code: 'JOURNAL_LINE_BOTH', message: 'A line cannot be both a debit and a credit.' };
  }
  if (!isBalanced(lines)) return { ok: false, code: 'JOURNAL_UNBALANCED', message: 'Total debits must equal total credits.' };
  return { ok: true };
}

/** Posting into a closed financial period is not allowed. */
export function canPostToPeriod(periodClosed: boolean): InvariantResult {
  if (periodClosed) return { ok: false, code: 'PERIOD_CLOSED', message: 'The financial period is closed.' };
  return { ok: true };
}
