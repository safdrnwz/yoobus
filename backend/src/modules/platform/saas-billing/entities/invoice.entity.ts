import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DocumentKind, InvoiceStatus, LineItem } from '../../../../common/logic/billing.util';

/** A SaaS billing invoice raised to a operator (operator). Managed by SuperAdmin. */
@Entity('saas_invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 30, unique: true }) invoiceNumber: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 12, default: 'INVOICE' }) kind: DocumentKind;
  @Index() @Column({ type: 'varchar', length: 16, default: 'ISSUED' }) status: InvoiceStatus;
  @Column({ type: 'varchar', length: 20, nullable: true }) customerGstin: string | null;
  @Column({ type: 'varchar', length: 2 }) supplierStateCode: string;
  @Column({ type: 'varchar', length: 2 }) customerStateCode: string;
  @Column({ type: 'jsonb' }) lineItems: LineItem[];
  @Column({ type: 'numeric', precision: 12, scale: 2 }) subtotal: number;
  @Column({ type: 'numeric', precision: 5, scale: 4 }) gstRate: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) cgst: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) sgst: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) igst: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) total: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) amountPaid: number;
  @Column({ type: 'timestamptz', nullable: true }) dueDate: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) issuedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
}
