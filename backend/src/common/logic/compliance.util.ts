/**
 * Pure, testable rules for the platform Compliance & Data Governance module (SuperAdmin):
 * data-subject request lifecycle and consent evaluation.
 */
export type DsrType = 'ACCESS' | 'CORRECTION' | 'DELETION';
export type DsrStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

const DSR_TRANSITIONS: Record<DsrStatus, DsrStatus[]> = {
  PENDING: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
};

export function dsrCanTransition(from: DsrStatus, to: DsrStatus): InvariantResult {
  if (!DSR_TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'DSR_INVALID_TRANSITION', message: `A data request cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}

/** The latest consent record for a purpose wins. */
export function isConsentGranted(records: { purpose: string; granted: boolean; recordedAt: number }[], purpose: string): boolean {
  const forPurpose = records.filter((r) => r.purpose === purpose).sort((a, b) => b.recordedAt - a.recordedAt);
  return forPurpose.length > 0 ? forPurpose[0].granted : false;
}
