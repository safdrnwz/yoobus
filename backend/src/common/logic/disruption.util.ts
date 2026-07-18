/** Pure, testable disruption / control-tower rules. */
export interface InvariantResult { ok: boolean; code?: string; message?: string; }
export type DisruptionStatus = 'OPEN' | 'MITIGATING' | 'RESOLVED' | 'CLOSED';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const TRANSITIONS: Record<DisruptionStatus, DisruptionStatus[]> = {
  OPEN: ['MITIGATING', 'RESOLVED', 'CLOSED'],
  MITIGATING: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [],
};

export function disruptionCanTransition(from: DisruptionStatus, to: DisruptionStatus): InvariantResult {
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'DISRUPTION_INVALID_TRANSITION', message: `A disruption cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}

/** Critical/high disruptions warrant declaring a major incident. */
export function isMajorIncident(severity: Severity): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}
