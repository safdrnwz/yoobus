import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TripStatus } from '../../../../common/enums/trip-status.enum';
@Entity('trips')
@Index(['operatorId', 'departureDate', 'status'])
export class Trip {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid' }) routeId: string;
  @Column({ type: 'uuid' }) busId: string;
  @Column({ type: 'uuid', nullable: true }) driverId: string | null;
  @Column({ type: 'date' }) departureDate: string;
  @Column({ type: 'varchar', length: 5 }) departureTime: string;
  @Column({ type: 'numeric', precision: 4, scale: 2, default: 1 }) fareMultiplier: number;

  /**
   * The bus's seating, COPIED at the moment this trip was created (spec §24).
   *
   * Bookings must never depend on a layout that can still change. Republish a template —
   * renumber a row, remove a seat — and without this copy, a passenger holding seat "1A"
   * would find that seat had quietly become someone else's, or vanished. The copy makes the
   * past immutable: whatever happens to the drawing afterwards cannot reach backwards into a
   * trip that already exists.
   *
   * Null on trips created before layouts existed — those fall back to reading the bus, which
   * is exactly what they did before, so nothing old breaks.
   */
  @Column({ type: 'jsonb', nullable: true })
  seatSnapshot: {
    seatMap: string[];
    totalSeats: number;
    ladiesReservedSeats: string[];
    maleOnlySeats?: string[];
    seatAdjacency: Record<string, string>;
    seatLayout: unknown;
    layoutTemplateId?: string | null;
    layoutVersion?: number | null;
  } | null;
  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.SCHEDULED }) status: TripStatus;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
