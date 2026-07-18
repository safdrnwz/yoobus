import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BookingSeat } from './booking-seat.entity';
import { BookingStatus } from '../../../../common/enums/booking-status.enum';
@Entity('bookings')
@Index(['operatorId', 'status'])
@Index(['tripId', 'status'])
export class Booking {
  @PrimaryGeneratedColumn('uuid') id: string;
  // Sales-channel attribution (DIRECT, or an OTA like REDBUS/ABHIBUS).
  @Index() @Column({ type: 'varchar', length: 20, default: 'DIRECT' }) source: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) channelCode: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) otaRef: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 }) pnr: string;
  @Index() @Column({ type: 'uuid' }) userId: string;      // passenger (global)
  @Index() @Column({ type: 'uuid' }) operatorId: string;  // operator of the trip
  @Column({ type: 'uuid' }) tripId: string;
  @Column({ type: 'int' }) boardingStopOrder: number;
  @Column({ type: 'int' }) droppingStopOrder: number;
  @Column({ type: 'uuid' }) boardingStopId: string;
  @Column({ type: 'uuid' }) droppingStopId: string;
  // tax/commission snapshot (freeze at booking time)
  @Column({ type: 'numeric', precision: 10, scale: 2 }) baseFare: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) fareGst: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) payableByPassenger: number;
  @Column({ type: 'numeric', precision: 5, scale: 4 }) commissionRateSnapshot: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) commissionBase: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) commissionGst: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) tcs: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) tds: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) operatorNet: number;
  // Phase 3: optional travel insurance add-on
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) insurancePremium: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) insuranceGst: number;
  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.CONFIRMED }) status: BookingStatus;
  @Column({ type: 'varchar', length: 250, nullable: true }) cancelReason: string;
  @OneToMany(() => BookingSeat, (s) => s.booking, { cascade: true, eager: true }) seats: BookingSeat[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
