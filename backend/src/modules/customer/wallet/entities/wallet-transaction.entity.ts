import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { WalletEntryType } from '../../../../common/logic/wallet.util';

/** Append-only wallet ledger; balance is derived by summing entries. */
@Entity('wallet_transactions')
@Index(['userId', 'createdAt'])
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 6 }) type: WalletEntryType; // CREDIT | DEBIT
  @Column({ type: 'numeric', precision: 10, scale: 2 }) amount: number;
  @Column({ type: 'varchar', length: 40 }) reason: string; // TOPUP | BOOKING_PAYMENT | REFUND | ADMIN_CREDIT ...
  @Column({ type: 'uuid', nullable: true }) referenceId: string | null;
  @CreateDateColumn() createdAt: Date;
}
