import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
// Stops global ho sakte (shared master) — operatorId optional for operator-specific.
@Entity('stops')
export class Stop {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 120 }) city: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) state: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 10 }) code: string;
  // OSM geocode (Nominatim self-hosted se aayega)
  @Column({ type: 'double precision', nullable: true }) latitude: number;
  @Column({ type: 'double precision', nullable: true }) longitude: number;
  @CreateDateColumn() createdAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
