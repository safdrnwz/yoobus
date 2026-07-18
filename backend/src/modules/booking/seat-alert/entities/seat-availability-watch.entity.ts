import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A shopper asked to be told when a full trip has a seat again (not a waitlist — no auto-booking). */
@Entity('seat_availability_watches')
@Index(['tripId', 'status'])
export class SeatAvailabilityWatch {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @Column({ type: 'varchar', length: 150 }) email: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) phone: string | null;
  @Index() @Column({ type: 'uuid' }) tripId: string;
  @Column({ type: 'uuid' }) boardingStopId: string;
  @Column({ type: 'uuid' }) droppingStopId: string;
  @Column({ type: 'varchar', length: 10, default: 'WATCHING' }) status: string; // WATCHING | NOTIFIED
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) notifiedAt: Date | null;
}
