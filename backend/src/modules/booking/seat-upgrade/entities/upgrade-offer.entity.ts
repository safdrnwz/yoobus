import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type UpgradeStatus = 'OFFERED' | 'APPLIED' | 'REJECTED';

/** A seat-category upgrade offer against a booking. */
@Entity('seat_upgrade_offers')
export class UpgradeOffer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) bookingId: string;
  @Column({ type: 'varchar', length: 20 }) fromCategory: string;
  @Column({ type: 'varchar', length: 20 }) toCategory: string;
  @Column({ type: 'boolean', default: false }) complimentary: boolean;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) fareDifference: number;
  @Column({ type: 'varchar', length: 10, default: 'OFFERED' }) status: UpgradeStatus;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
