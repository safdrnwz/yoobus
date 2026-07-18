import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DisruptionStatus, Severity } from '../../../../common/logic/disruption.util';

/** A service disruption (breakdown, accident, weather, strike) tracked by the control tower. */
@Entity('disruption_events')
export class DisruptionEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid', nullable: true }) tripId: string | null;
  @Column({ type: 'varchar', length: 30 }) type: string; // BREAKDOWN | ACCIDENT | WEATHER | STRIKE | OTHER
  @Column({ type: 'varchar', length: 10 }) severity: Severity;
  @Column({ type: 'varchar', length: 12, default: 'OPEN' }) status: DisruptionStatus;
  @Column({ type: 'boolean', default: false }) majorIncident: boolean;
  @Column({ type: 'varchar', length: 500 }) description: string;
  @Column({ type: 'uuid', nullable: true }) backupBusId: string | null;
  @Column({ type: 'uuid', nullable: true }) divertedToRouteId: string | null;
  @Column({ type: 'varchar', length: 1000, nullable: true }) rootCause: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
