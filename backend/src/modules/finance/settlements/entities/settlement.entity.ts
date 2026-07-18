import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'date' }) periodFrom: string;
  @Column({ type: 'date' }) periodTo: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) collectedBaseFare: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) platformEarning: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) refundsPaid: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) payout: number;
  @Column({ type: 'varchar', length: 15, default: 'PENDING' }) status: string; // PENDING/PAID
  @CreateDateColumn() createdAt: Date;
}
