import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A platform maintenance window scheduled by SuperAdmin. During an ACTIVE window,
 * operator-side changes are blocked but passenger bookings keep running.
 */
@Entity('maintenance_windows')
export class MaintenanceWindow {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'timestamptz' }) startAt: Date;
  @Index() @Column({ type: 'timestamptz' }) endAt: Date;
  @Column({ type: 'varchar', length: 300 }) message: string;
  @Column({ type: 'varchar', length: 20, default: 'SCHEDULED' }) status: string; // SCHEDULED | ACTIVE | COMPLETED | CANCELLED
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  // day-offsets (e.g. 7,6,5...) for which a reminder email has already been sent
  @Column({ type: 'jsonb', default: () => "'[]'" }) remindersSent: number[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
