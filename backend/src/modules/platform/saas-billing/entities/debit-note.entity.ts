import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Debit note raised against an invoice (append-only). */
@Entity('saas_debit_notes')
export class DebitNote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) invoiceId: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 30 }) noteNumber: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) amount: number;
  @Column({ type: 'varchar', length: 200 }) reason: string;
  @CreateDateColumn() createdAt: Date;
}
