import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('setup_invoices')
export class SetupInvoice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  // Per-bus setup invoice (idempotent per bus). NULL busId = a one-time platform fee invoice.
  @Index({ unique: true, where: '"busId" IS NOT NULL' }) @Column({ type: 'uuid', nullable: true }) busId: string | null;
  @Column({ type: 'varchar', length: 20 }) invoiceNumber: string;
  // 'SETUP' (per bus) | 'PLATFORM_FEE' (one-time onboarding fee).
  @Column({ type: 'varchar', length: 16, default: 'SETUP' }) kind: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) amount: number;
  @Column({ type: 'varchar', length: 15, default: 'UNPAID' }) status: string;
  @CreateDateColumn() createdAt: Date;
}
