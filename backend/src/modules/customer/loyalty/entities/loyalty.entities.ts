import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Each customer's shareable referral code. */
@Entity('referral_codes')
export class ReferralCode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'uuid' }) userId: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 12 }) code: string;
  @CreateDateColumn() createdAt: Date;
}

/** One referral redemption (a new user used someone's code). */
@Entity('referral_redemptions')
@Unique(['refereeId'])
export class ReferralRedemption {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) referrerId: string;
  @Column({ type: 'uuid' }) refereeId: string;
  @Column({ type: 'varchar', length: 12 }) code: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) referrerReward: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) refereeReward: number;
  @CreateDateColumn() createdAt: Date;
}

/** Append-only points ledger; balance = sum(EARN) - sum(REDEEM). */
@Entity('points_transactions')
@Index(['userId', 'createdAt'])
export class PointsTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 6 }) type: 'EARN' | 'REDEEM';
  @Column({ type: 'int' }) points: number;
  @Column({ type: 'varchar', length: 40 }) reason: string;
  @Column({ type: 'uuid', nullable: true }) referenceId: string | null;
  @CreateDateColumn() createdAt: Date;
}
