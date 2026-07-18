import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('commission_ledger')
export class CommissionLedger {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid' }) bookingId: string;
  // CREDIT (booking) ya DEBIT (cancellation reversal)
  @Column({ type: 'varchar', length: 10 }) entryType: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) commissionBase: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) commissionGst: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) tcs: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) tds: number;
  @CreateDateColumn() createdAt: Date;
}
