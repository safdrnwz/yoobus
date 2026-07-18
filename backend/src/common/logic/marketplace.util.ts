/**
 * Pure, testable rules for the platform Marketplace & Partner ecosystem (SuperAdmin):
 * partner lifecycle transitions and commission / revenue-share validation.
 * Distinct from API partners (technical API consumers) — these are business partners
 * (resellers, white-label, franchise, affiliate).
 */
export type PartnerType = 'RESELLER' | 'WHITE_LABEL' | 'FRANCHISE' | 'AFFILIATE';
export type MarketplacePartnerStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

const TRANSITIONS: Record<MarketplacePartnerStatus, MarketplacePartnerStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUSPENDED'],
  SUSPENDED: ['APPROVED'],
  REJECTED: [],
};

export function partnerCanTransition(from: MarketplacePartnerStatus, to: MarketplacePartnerStatus): InvariantResult {
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'MARKETPLACE_PARTNER_INVALID_TRANSITION', message: `A partner cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}

/** Commission and revenue-share are fractions between 0 and 1. */
export function isValidShare(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

export function validateShares(commissionRate: number, revenueSharePct: number): InvariantResult {
  if (!isValidShare(commissionRate)) {
    return { ok: false, code: 'INVALID_COMMISSION_RATE', message: 'Commission rate must be between 0 and 1.' };
  }
  if (!isValidShare(revenueSharePct)) {
    return { ok: false, code: 'INVALID_REVENUE_SHARE', message: 'Revenue share must be between 0 and 1.' };
  }
  return { ok: true };
}
