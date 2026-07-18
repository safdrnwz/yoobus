import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type BoardingOutcome = 'BOARDED' | 'NO_SHOW';

/** A boarding scan outcome for a booking on a trip (one record per booking per trip). */
@Entity('boarding_records')
@Unique(['tripId', 'bookingId'])
export class BoardingRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Index() @Column({ type: 'uuid' }) tripId: string;
  @Index() @Column({ type: 'uuid' }) bookingId: string;
  @Column({ type: 'varchar', length: 12 }) pnr: string;
  @Column({ type: 'varchar', length: 8 }) outcome: BoardingOutcome;
  @CreateDateColumn() scannedAt: Date;
}
