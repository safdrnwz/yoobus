import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
// Temporary seat block with a time-to-live. An active hold makes the seat unavailable.
@Entity('seat_holds')
@Index(['tripId', 'seatNumber'])
export class SeatHold {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) holdToken: string; // Groups all seats from a single selection.
  @Column({ type: 'uuid' }) tripId: string;
  @Column({ type: 'varchar', length: 10 }) seatNumber: string;
  @Column({ type: 'int' }) boardingStopOrder: number;
  @Column({ type: 'int' }) droppingStopOrder: number;
  @Column({ type: 'uuid' }) boardingStopId: string;
  @Column({ type: 'uuid' }) droppingStopId: string;
  @Index() @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) lockedFarePerSeat: number | null; // dynamic price locked at hold time
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}
