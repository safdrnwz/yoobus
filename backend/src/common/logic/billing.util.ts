/**
 * Pure, testable billing rules for the SuperAdmin Billing & Invoicing module:
 * GST split (intra-state CGST+SGST vs inter-state IGST), invoice numbering, totals,
 * invoice lifecycle guards, and credit/debit note validation.
 */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'CANCELLED';
export type DocumentKind = 'INVOICE' | 'PROFORMA' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface GstSplit {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Basic structural validation of a 15-character GSTIN. */
export function isValidGstin(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

/** The first two digits of a GSTIN are the state code. */
export function stateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2);
}

/**
 * Splits GST. When supplier and customer are in the same state it is an intra-state
 * supply (CGST + SGST, each half the rate); otherwise it is inter-state (IGST, full rate).
 */
export function computeGstSplit(taxable: number, gstRate: number, supplierState: string, customerState: string): GstSplit {
  const intraState = supplierState === customerState;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (intraState) {
    cgst = round2((taxable * gstRate) / 2);
    sgst = round2((taxable * gstRate) / 2);
  } else {
    igst = round2(taxable * gstRate);
  }
  const totalTax = round2(cgst + sgst + igst);
  return { taxable: round2(taxable), cgst, sgst, igst, totalTax, total: round2(taxable + totalTax) };
}

/** Sums line items into a taxable subtotal. */
export function computeSubtotal(items: LineItem[]): number {
  return round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
}

/** Formats a sequential invoice number, e.g. INV-2026-000123. */
export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

/** An invoice can be voided only before payment is recorded. */
export function canVoidInvoice(status: InvoiceStatus): InvariantResult {
  if (['PAID', 'PARTIALLY_PAID', 'VOID', 'CANCELLED'].includes(status)) {
    return { ok: false, code: 'INVOICE_NOT_VOIDABLE', message: 'Only an unpaid, issued invoice can be voided.' };
  }
  return { ok: true };
}

/** A payment can be recorded only against an issued or partially paid invoice. */
export function canRecordPayment(status: InvoiceStatus): InvariantResult {
  if (!['ISSUED', 'PARTIALLY_PAID'].includes(status)) {
    return { ok: false, code: 'INVOICE_NOT_PAYABLE', message: 'Payment can only be recorded against an issued invoice.' };
  }
  return { ok: true };
}

/** Determines the next status after a payment is applied. */
export function statusAfterPayment(totalDue: number, alreadyPaid: number, newPayment: number): InvoiceStatus {
  const paid = round2(alreadyPaid + newPayment);
  if (paid >= totalDue) return 'PAID';
  return 'PARTIALLY_PAID';
}

/** A credit note cannot exceed the invoice total minus what has already been credited. */
export function canApplyCreditNote(invoiceTotal: number, alreadyCredited: number, amount: number): InvariantResult {
  if (amount <= 0) return { ok: false, code: 'CREDIT_NOTE_INVALID_AMOUNT', message: 'Credit note amount must be greater than zero.' };
  if (round2(alreadyCredited + amount) > invoiceTotal) {
    return { ok: false, code: 'CREDIT_NOTE_EXCEEDS_INVOICE', message: 'The total credit cannot exceed the invoice amount.' };
  }
  return { ok: true };
}

/** A debit note must be a positive amount and cannot target a cancelled/void invoice. */
export function canApplyDebitNote(status: InvoiceStatus, amount: number): InvariantResult {
  if (amount <= 0) return { ok: false, code: 'DEBIT_NOTE_INVALID_AMOUNT', message: 'Debit note amount must be greater than zero.' };
  if (['VOID', 'CANCELLED'].includes(status)) {
    return { ok: false, code: 'DEBIT_NOTE_CLOSED_INVOICE', message: 'A debit note cannot be raised on a void or cancelled invoice.' };
  }
  return { ok: true };
}
