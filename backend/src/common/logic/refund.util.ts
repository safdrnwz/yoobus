// Time-slab based cancellation refund, driven by how many hours before departure the cancellation happens.
export interface RefundSlab { minHoursBefore: number; refundPct: number; }
// Default policy (config se override ho sakti). Sorted desc by hours.
export const DEFAULT_REFUND_SLABS: RefundSlab[] = [
  { minHoursBefore: 24, refundPct: 0.90 }, // >24h => 90%
  { minHoursBefore: 12, refundPct: 0.50 }, // 12-24h => 50%
  { minHoursBefore: 4,  refundPct: 0.25 }, // 4-12h => 25%
  { minHoursBefore: 0,  refundPct: 0.0  }, // <4h => 0%
];

export function refundPercent(hoursBeforeDeparture: number, slabs = DEFAULT_REFUND_SLABS): number {
  for (const s of [...slabs].sort((a, b) => b.minHoursBefore - a.minHoursBefore)) {
    if (hoursBeforeDeparture >= s.minHoursBefore) return s.refundPct;
  }
  return 0;
}

export function computeRefund(amountPaid: number, hoursBeforeDeparture: number, slabs = DEFAULT_REFUND_SLABS) {
  if (amountPaid < 0) throw new Error('amountPaid cannot be negative');
  const pct = refundPercent(hoursBeforeDeparture, slabs);
  const refund = Math.round(amountPaid * pct * 100) / 100;
  return { refundPct: pct, refundAmount: refund, cancellationCharge: Math.round((amountPaid - refund) * 100) / 100 };
}
