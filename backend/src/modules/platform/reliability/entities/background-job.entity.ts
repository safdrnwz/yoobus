import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { JobStatus } from '../../../../common/logic/reliability.util';

/** A registered background job and its latest run status. */
@Entity('background_jobs')
export class BackgroundJob {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 80 }) name: string;
  @Column({ type: 'varchar', length: 10, default: 'QUEUED' }) status: JobStatus;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'varchar', length: 300, nullable: true }) error: string | null;
  @Column({ type: 'timestamptz', nullable: true }) lastRunAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
