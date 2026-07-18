/** Rounds to 2 decimals. */
function round2(n: number): number { return Math.round(n * 100) / 100; }

export interface InsuranceOpts { premiumPerPassenger?: number; gstRate?: number; }

/**
 * Booking-time travel-insurance add-on premium (per passenger) with GST.
 * Defaults: premium 15 per passenger, GST 18%.
 */
export function computeInsurance(passengers: number, opts: InsuranceOpts = {}) {
  if (!Number.isInteger(passengers) || passengers <= 0) {
    throw new Error('Insurance requires at least one passenger.');
  }
  const per = opts.premiumPerPassenger ?? 15;
  const rate = opts.gstRate ?? 0.18;
  const premium = round2(per * passengers);
  const gst = round2(premium * rate);
  return { premium, gst, total: round2(premium + gst) };
}
