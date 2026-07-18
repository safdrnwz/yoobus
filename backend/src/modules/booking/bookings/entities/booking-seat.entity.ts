import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from './booking.entity';
@Entity('booking_seats')
@Index(['tripId', 'seatNumber'])
export class BookingSeat {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Booking, (b) => b.seats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' }) booking: Booking;
  @Column({ name: 'booking_id' }) bookingId: string;
  @Column({ name: 'trip_id', type: 'uuid' }) tripId: string;
  @Column({ type: 'varchar', length: 10 }) seatNumber: string;
  @Column({ type: 'int' }) boardingStopOrder: number;
  @Column({ type: 'int' }) droppingStopOrder: number;
  @Column({ type: 'varchar', length: 120 }) passengerName: string;
  @Column({ type: 'int' }) passengerAge: number;
  @Column({ type: 'varchar', length: 10 }) passengerGender: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) fare: number;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
}
