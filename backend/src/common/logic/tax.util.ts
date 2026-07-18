// ============================================================================
// India tax / platform-fee logic. RATES ARE CONFIGURABLE DEFAULTS — inhe ek
// These must be confirmed with a chartered accountant or tax professional. The latest rules change
// can change, so all rates come from configuration rather than being hardcoded.
//
// Default assumptions (financial-year typical, verify before production):
//  - AC contract carriage bus fare has 5% GST (non-AC stage carriage is often exempt).
//  - Platform commission (Yoo Bus -> operator) is a service: GST 18%
//  - Marketplace TCS under section 52 CGST: 1% (0.5% CGST + 0.5% SGST) on net taxable supply.
//  - TDS under section 194-O (income tax): 0.1% on gross sale (on the operator's taxable income side).
// ============================================================================

export interface TaxConfig {
  fareGstRate: number;        // e.g. 0.05 (AC) or 0 (exempt)
  commissionGstRate: number;  // e.g. 0.18
  tcsRate: number;            // e.g. 0.01
  tdsRate: number;            // e.g. 0.001
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  fareGstRate: 0.05,
  commissionGstRate: 0.18,
  tcsRate: 0.01,
  tdsRate: 0.001,
};

export interface BookingTaxBreakup {
  baseFare: number;          // GST-exclusive base (seats * segment fare)
  fareGst: number;           // GST on the fare (shown to the passenger).
  payableByPassenger: number;// baseFare + fareGst
  commissionBase: number;    // platform commission on baseFare
  commissionGst: number;     // GST on commission
  tcs: number;               // marketplace TCS
  tds: number;               // 194-O TDS
  operatorNet: number;       // The amount the operator receives at settlement.
  platformRevenue: number;   // commission + commissionGst (Yoo Bus side)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// commissionRate is per operator (e.g. 0.03 = 3%). isAcFare controls GST applicability.
export function computeBookingTax(
  baseFare: number,
  commissionRate: number,
  cfg: TaxConfig = DEFAULT_TAX_CONFIG,
  isAcFare = true,
): BookingTaxBreakup {
  if (baseFare < 0) throw new Error('baseFare cannot be negative');
  if (commissionRate < 0 || commissionRate > 1)
    throw new Error('commissionRate must be between 0 and 1');

  const fareGstRate = isAcFare ? cfg.fareGstRate : 0;
  const fareGst = round2(baseFare * fareGstRate);
  const payableByPassenger = round2(baseFare + fareGst);

  const commissionBase = round2(baseFare * commissionRate);
  const commissionGst = round2(commissionBase * cfg.commissionGstRate);

  const tcs = round2(baseFare * cfg.tcsRate);
  const tds = round2(baseFare * cfg.tdsRate);

  // Operator net = base fare - commission - commissionGst - tcs - tds
  const operatorNet = round2(
    baseFare - commissionBase - commissionGst - tcs - tds,
  );
  const platformRevenue = round2(commissionBase + commissionGst);

  return {
    baseFare: round2(baseFare),
    fareGst,
    payableByPassenger,
    commissionBase,
    commissionGst,
    tcs,
    tds,
    operatorNet,
    platformRevenue,
  };
}

// On cancellation, reverse the commission: refund exactly what the platform had taken.
export function reverseCommission(breakup: BookingTaxBreakup) {
  return {
    commissionReversed: breakup.commissionBase,
    commissionGstReversed: breakup.commissionGst,
    tcsReversed: breakup.tcs,
    tdsReversed: breakup.tds,
  };
}
