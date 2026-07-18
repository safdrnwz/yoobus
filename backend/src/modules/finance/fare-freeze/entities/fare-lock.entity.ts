import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A price the customer paid a small fee to lock for a fixed window (airline-style hold). */
@Entity('fare_locks')
@Index(['userId', 'tripId', 'status'])
export class FareLock {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'uuid' }) token: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'uuid' }) tripId: string;
  @Column({ type: 'uuid' }) boardingStopId: string;
  @Column({ type: 'uuid' }) droppingStopId: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) lockedFarePerSeat: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) feeAmount: number;
  @Column({ type: 'varchar', length: 10, default: 'ACTIVE' }) status: string; // ACTIVE | USED | EXPIRED
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @CreateDateColumn() createdAt: Date;
}
