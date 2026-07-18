import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CouponType } from '../../../../common/logic/coupon.util';

/** A discount code. operatorId null => platform-wide; otherwise scoped to one operator. */
@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 40 }) code: string;
  @Index() @Column({ type: 'uuid', nullable: true }) operatorId: string | null;
  @Column({ type: 'varchar', length: 8 }) type: CouponType; // PERCENT | FLAT
  @Column({ type: 'numeric', precision: 10, scale: 2 }) value: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) maxDiscount: number | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) minFare: number | null;
  @Column({ type: 'int', nullable: true }) usageLimit: number | null;
  @Column({ type: 'int', default: 0 }) usedCount: number;
  @Column({ type: 'int', nullable: true }) perUserLimit: number | null;
  @Column({ type: 'timestamptz', nullable: true }) validFrom: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) validTo: Date | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}

/** One redemption of a coupon (enforces total + per-user limits, and audit). */
@Entity('coupon_redemptions')
@Index(['couponId', 'userId'])
export class CouponRedemption {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) couponId: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'uuid', nullable: true }) bookingId: string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) discountAmount: number;
  @CreateDateColumn() createdAt: Date;
}
