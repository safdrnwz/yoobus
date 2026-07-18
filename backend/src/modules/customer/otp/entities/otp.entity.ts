import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
@Entity('otps')
export class Otp {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 150 }) email: string;
  @Column({ type: 'varchar', length: 30 }) purpose: string; // REGISTER / LOGIN
  @Column({ type: 'varchar' }) codeHash: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'timestamptz' }) lastSentAt: Date;
  @Column({ type: 'boolean', default: false }) consumed: boolean;
  // guest registration ke pending details (verify ke baad account banega)
  @Column({ type: 'jsonb', nullable: true }) pendingProfile: any;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
