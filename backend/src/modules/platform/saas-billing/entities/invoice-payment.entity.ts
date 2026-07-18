import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only record of payments received against an invoice. */
@Entity('saas_invoice_payments')
export class InvoicePayment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) invoiceId: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) amount: number;
  @Column({ type: 'varchar', length: 20 }) method: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) reference: string | null;
  @CreateDateColumn() paidAt: Date;
}
