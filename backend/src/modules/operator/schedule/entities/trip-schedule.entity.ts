import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type Recurrence = 'WEEKLY' | 'SEASONAL';

/**
 * A recurring trip schedule template. Trips are generated from it by delegating to the
 * TripsService (the single home for trip creation) — this entity never duplicates trip logic.
 */
@Entity('trip_schedules')
export class TripSchedule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'uuid' }) routeId: string;
  @Column({ type: 'uuid' }) busId: string;
  @Column({ type: 'varchar', length: 5 }) departureTime: string; // HH:mm
  @Column({ type: 'jsonb' }) daysOfWeek: number[]; // 0=Sun ... 6=Sat
  @Column({ type: 'varchar', length: 10, default: 'WEEKLY' }) recurrence: Recurrence;
  @Column({ type: 'date', nullable: true }) seasonStart: string | null;
  @Column({ type: 'date', nullable: true }) seasonEnd: string | null;
  @Column({ type: 'numeric', precision: 4, scale: 2, default: 1 }) fareMultiplier: number;
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date | null;
}
