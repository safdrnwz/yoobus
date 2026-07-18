/** Pure, testable wallet math. */
export type WalletEntryType = 'CREDIT' | 'DEBIT';
export interface WalletEntry { type: WalletEntryType; amount: number; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Balance = sum(credits) - sum(debits). */
export function walletBalance(entries: WalletEntry[]): number {
  return round2(entries.reduce((b, e) => b + (e.type === 'CREDIT' ? Number(e.amount) : -Number(e.amount)), 0));
}

/** Can only debit a positive amount that does not exceed the balance. */
export function canDebit(balance: number, amount: number): boolean {
  return amount > 0 && balance >= amount;
}
