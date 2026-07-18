import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
// Latest GPS position per trip (driver app/device se ping). OSM map pe dikhega.
@Entity('trip_locations')
export class TripLocation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'uuid' }) tripId: string;
  @Column({ type: 'double precision' }) latitude: number;
  @Column({ type: 'double precision' }) longitude: number;
  @Column({ type: 'double precision', nullable: true }) speedKmph: number;
  @UpdateDateColumn() updatedAt: Date;
}
