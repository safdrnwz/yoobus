import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';

/**
 * GPS Integration — data model.
 *
 * Four tables, all self-contained: the tracking token stores its own snapshot (pnr, operatorId,
 * busId, validity) so a passenger-tracking read never has to join across bookings/trips and can
 * never leak another operator's data.
 */

/** Platform-level: which GPS providers the SuperAdmin has switched on for the whole platform. */
@Entity('gps_providers')
export class GpsProvider {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 40 }) providerName: string;
  @Column({ type: 'boolean', default: false }) enabled: boolean;
  @UpdateDateColumn() updatedAt: Date;
  @CreateDateColumn() createdAt: Date;
}

/** Operator-level: one GPS configuration per operator (the provider they connected). */
@Entity('gps_configurations')
export class GpsConfiguration {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 40 }) provider: string;
  @Column({ type: 'varchar', length: 300 }) apiBaseUrl: string;
  @Column({ type: 'varchar', length: 300 }) apiKey: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) apiSecret: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) clientId: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) accessToken: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) webhookUrl: string | null;
  // UNTESTED | CONNECTED | DISCONNECTED
  @Column({ type: 'varchar', length: 16, default: 'UNTESTED' }) status: string;
  @Column({ type: 'timestamptz', nullable: true }) lastTestedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

/** Operator-level: maps one of the operator's buses to a physical GPS device. */
@Entity('gps_devices')
@Unique(['operatorId', 'busId'])
export class GpsDevice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid' }) busId: string;
  @Column({ type: 'varchar', length: 40 }) provider: string;
  @Column({ type: 'varchar', length: 40 }) imei: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) deviceId: string | null;
  // ACTIVE | OFFLINE
  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' }) status: string;
  @CreateDateColumn() createdAt: Date;
}

/** Per-booking passenger tracking link. One per booking; the token is the capability. */
@Entity('gps_tracking_tokens')
export class TrackingToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'uuid' }) bookingId: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'varchar', length: 12 }) pnr: string;
  @Column({ type: 'uuid' }) tripId: string;
  @Column({ type: 'uuid' }) busId: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) token: string;
  @Column({ type: 'timestamptz' }) validFrom: Date;
  @Column({ type: 'timestamptz' }) validTo: Date;
  // ACTIVE | EXPIRED
  @Column({ type: 'varchar', length: 12, default: 'ACTIVE' }) status: string;
  @CreateDateColumn() createdAt: Date;
}
