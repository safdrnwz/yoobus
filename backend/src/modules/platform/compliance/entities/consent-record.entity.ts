import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only consent record. The latest record per purpose is authoritative. */
@Entity('consent_records')
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 150 }) subjectEmail: string;
  @Column({ type: 'varchar', length: 60 }) purpose: string;
  @Column({ type: 'boolean' }) granted: boolean;
  @CreateDateColumn() recordedAt: Date;
}
