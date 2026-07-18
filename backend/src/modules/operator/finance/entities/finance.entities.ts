import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { JournalLine } from '../../../../common/logic/accounting.util';

/** A balanced double-entry journal entry (debits == credits). */
@Entity('accounting_journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 7 }) period: string; // YYYY-MM
  @Column({ type: 'varchar', length: 200 }) narration: string;
  @Column({ type: 'jsonb' }) lines: JournalLine[];
  @Column({ type: 'numeric', precision: 12, scale: 2 }) total: number;
  @Column({ type: 'uuid', nullable: true }) postedBy: string | null;
  @CreateDateColumn() createdAt: Date;
}

/** An accounting period that can be open or closed (no posting once closed). */
@Entity('accounting_periods')
@Unique(['operatorId', 'period'])
export class FinancialPeriod {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 7 }) period: string; // YYYY-MM
  @Column({ type: 'boolean', default: false }) closed: boolean;
  @CreateDateColumn() createdAt: Date;
}
