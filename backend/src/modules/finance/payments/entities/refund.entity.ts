import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) bookingId: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) amountPaid: number;
  @Column({ type: 'numeric', precision: 5, scale: 4 }) refundPct: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) refundAmount: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) cancellationCharge: number;
  @Column({ type: 'varchar', length: 15, default: 'WALLET' }) mode: string; // WALLET / SOURCE
  @Column({ type: 'varchar', length: 15, default: 'COMPLETED' }) status: string;
  @CreateDateColumn() createdAt: Date;
}
