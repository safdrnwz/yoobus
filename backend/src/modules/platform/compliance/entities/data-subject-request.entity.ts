import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DsrStatus, DsrType } from '../../../../common/logic/compliance.util';

/** A GDPR-style data-subject request (access / correction / deletion). */
@Entity('data_subject_requests')
export class DataSubjectRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 150 }) subjectEmail: string;
  @Column({ type: 'varchar', length: 12 }) type: DsrType;
  @Column({ type: 'varchar', length: 12, default: 'PENDING' }) status: DsrStatus;
  @Column({ type: 'varchar', length: 300, nullable: true }) note: string | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
