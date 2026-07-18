import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** A device/browser a user has logged in from (for new-device alerts). */
@Entity('known_devices')
@Index(['userId', 'fingerprint'], { unique: true })
export class KnownDevice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 64 }) fingerprint: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) userAgent: string | null;
  @Column({ type: 'varchar', length: 60, nullable: true }) ip: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() lastSeenAt: Date;
}
