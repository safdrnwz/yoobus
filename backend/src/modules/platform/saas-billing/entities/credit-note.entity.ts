import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Credit note issued against an invoice (append-only). */
@Entity('saas_credit_notes')
export class CreditNote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) invoiceId: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 30 }) noteNumber: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) amount: number;
  @Column({ type: 'varchar', length: 200 }) reason: string;
  @CreateDateColumn() createdAt: Date;
}
