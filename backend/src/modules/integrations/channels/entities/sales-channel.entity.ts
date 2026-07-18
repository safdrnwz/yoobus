import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A distribution channel an operator sells through (DIRECT, REDBUS, ABHIBUS, ...).
 * All channels book through the same BookingsService, so booking_seats remains the
 * single source of truth and cross-channel double-booking is structurally impossible.
 */
@Entity('sales_channels')
@Index(['operatorId', 'code'], { unique: true })
export class SalesChannel {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 40 }) code: string; // e.g. REDBUS
  @Column({ type: 'varchar', length: 120 }) displayName: string;
  @Column({ type: 'numeric', precision: 5, scale: 4, default: 0 }) channelCommissionRate: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
