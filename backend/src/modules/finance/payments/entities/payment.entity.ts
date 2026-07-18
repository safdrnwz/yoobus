import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('payments')
@Index(['bookingId', 'status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) bookingId: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) amount: number;
  @Column({ type: 'varchar', length: 20, default: 'RAZORPAY' }) gateway: string;
  @Column({ type: 'varchar', length: 20, default: 'PENDING' }) status: string; // PENDING/SUCCESS/FAILED/REFUNDED
  @Column({ type: 'varchar', length: 80, nullable: true }) reference: string;
  @Index() @Column({ type: 'varchar', length: 60, nullable: true }) razorpayOrderId: string | null;
  @Column({ type: 'varchar', length: 60, nullable: true }) razorpayPaymentId: string | null;
  @Column({ type: 'boolean', default: false }) signatureVerified: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
