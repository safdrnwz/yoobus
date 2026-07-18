/**
 * Bus document lifecycle logic (Bus Master spec §8.F / §9.G / §14.L).
 * Pure and unit-testable: document-type catalogue (expiry driven by type),
 * graded expiry alert levels, and overall bus compliance computation.
 */
import { daysToExpiry, isExpired } from './expiry.util';

export const BUS_DOC_TYPES = [
  'RC', 'INSURANCE', 'FITNESS', 'PERMIT', 'NATIONAL_PERMIT', 'STATE_PERMIT',
  'POLLUTION', 'ROAD_TAX', 'COMMERCIAL_TAX', 'AUTHORIZATION', 'OTHER',
] as const;
export type BusDocType = (typeof BUS_DOC_TYPES)[number];

/** Spec §8.F — "expiryDate should be controlled by document type configuration." */
export const DOC_TYPE_CONFIG: Record<BusDocType, { expiryRequired: boolean; requiredForCompliance: boolean }> = {
  RC:             { expiryRequired: false, requiredForCompliance: true },
  INSURANCE:      { expiryRequired: true,  requiredForCompliance: true },
  FITNESS:        { expiryRequired: true,  requiredForCompliance: true },
  PERMIT:         { expiryRequired: true,  requiredForCompliance: true },
  NATIONAL_PERMIT:{ expiryRequired: true,  requiredForCompliance: false },
  STATE_PERMIT:   { expiryRequired: true,  requiredForCompliance: false },
  POLLUTION:      { expiryRequired: true,  requiredForCompliance: true },
  ROAD_TAX:       { expiryRequired: false, requiredForCompliance: false },
  COMMERCIAL_TAX: { expiryRequired: false, requiredForCompliance: false },
  AUTHORIZATION:  { expiryRequired: false, requiredForCompliance: false },
  OTHER:          { expiryRequired: false, requiredForCompliance: false },
};

export type DocStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'REVOKED' | 'PENDING';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Spec §9.G — graded alerts: 30d WARNING, 15d ALERT, 7d CRITICAL, then EXPIRED. */
export type ExpiryAlertLevel = 'NONE' | 'WARNING' | 'ALERT' | 'CRITICAL' | 'EXPIRED';

export function expiryAlertLevel(expiryMs: number | null | undefined, nowMs: number): ExpiryAlertLevel {
  if (expiryMs == null) return 'NONE'; // non-expiring document types
  if (isExpired(expiryMs, nowMs)) return 'EXPIRED';
  const d = daysToExpiry(expiryMs, nowMs);
  if (d <= 7) return 'CRITICAL';
  if (d <= 15) return 'ALERT';
  if (d <= 30) return 'WARNING';
  return 'NONE';
}

export type BusComplianceStatus = 'COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NON_COMPLIANT' | 'PENDING_REVIEW';

export interface ComplianceDocInput {
  docType: BusDocType | string;
  documentStatus: DocStatus | string;
  expiresAt: number | null; // epoch ms, null = no expiry applicable
}

/**
 * Spec §14.L — overall bus compliance from its documents.
 *  - Any required document missing/expired/revoked → NON_COMPLIANT.
 *  - All required present & valid, but any within a warning window → PARTIALLY_COMPLIANT.
 *  - No documents at all → PENDING_REVIEW.
 *  - Otherwise → COMPLIANT.
 */
export function computeBusCompliance(docs: ComplianceDocInput[], nowMs: number): {
  status: BusComplianceStatus;
  missing: string[];
  expired: string[];
  expiring: string[];
} {
  const required = (Object.keys(DOC_TYPE_CONFIG) as BusDocType[]).filter((t) => DOC_TYPE_CONFIG[t].requiredForCompliance);
  const byType = new Map<string, ComplianceDocInput[]>();
  for (const d of docs) {
    const k = String(d.docType).toUpperCase();
    if (!byType.has(k)) byType.set(k, []);
    byType.get(k)!.push(d);
  }

  const missing: string[] = [];
  const expired: string[] = [];
  const expiring: string[] = [];

  for (const t of required) {
    const rows = (byType.get(t) ?? []).filter((d) => !['CANCELLED', 'REVOKED'].includes(String(d.documentStatus).toUpperCase()));
    if (!rows.length) { missing.push(t); continue; }
    // The best (latest-expiring) usable document decides the type's state.
    const valid = rows.filter((d) => d.expiresAt == null || !isExpired(d.expiresAt, nowMs));
    if (!valid.length) { expired.push(t); continue; }
    const best = valid.reduce((a, b) => ((a.expiresAt ?? Infinity) >= (b.expiresAt ?? Infinity) ? a : b));
    const level = expiryAlertLevel(best.expiresAt, nowMs);
    if (level !== 'NONE') expiring.push(t);
  }

  let status: BusComplianceStatus;
  if (!docs.length) status = 'PENDING_REVIEW';
  else if (missing.length || expired.length) status = 'NON_COMPLIANT';
  else if (expiring.length) status = 'PARTIALLY_COMPLIANT';
  else status = 'COMPLIANT';

  return { status, missing, expired, expiring };
}
