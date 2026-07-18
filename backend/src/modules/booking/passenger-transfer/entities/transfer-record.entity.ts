import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TransferStatus } from '../../../../common/logic/transfer.util';

/** A passenger transfer (bus exchange / re-accommodation) for a booking. */
@Entity('transfer_records')
export class TransferRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) bookingId: string;
  @Column({ type: 'uuid' }) fromTripId: string;
  @Column({ type: 'uuid' }) toTripId: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) reason: string | null;
  @Column({ type: 'varchar', length: 12, default: 'INITIATED' }) status: TransferStatus;
  @Column({ type: 'varchar', length: 12, nullable: true }) regeneratedPnr: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
