import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Tracks failed login attempts per email for brute-force lockout. */
@Entity('login_attempts')
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 150 }) email: string;
  @Column({ type: 'int', default: 0 }) failedCount: number;
  @Column({ type: 'timestamptz', nullable: true }) lockedUntil: Date | null;
  @UpdateDateColumn() updatedAt: Date;
}
