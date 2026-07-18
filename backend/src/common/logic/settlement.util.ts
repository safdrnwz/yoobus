// Operator payout = confirmed collection - platform commission(+gst) - tcs - tds - refunds
export interface SettlementInput {
  collectedBaseFare: number;   // confirmed bookings ka baseFare sum
  commissionBase: number;
  commissionGst: number;
  tcs: number;
  tds: number;
  refundsPaid: number;         // wallet/source refunds operator-funded portion
}
export function computePayout(i: SettlementInput) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const payout = i.collectedBaseFare - i.commissionBase - i.commissionGst - i.tcs - i.tds - i.refundsPaid;
  return { payout: round(payout), platformEarning: round(i.commissionBase + i.commissionGst) };
}
