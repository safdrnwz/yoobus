import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PointsTransaction, ReferralCode, ReferralRedemption } from './entities/loyalty.entities';
import { WalletService } from '../wallet/wallet.service';
import { AppException } from '../../../common/errors/app-exception';
import { canRedeemReferral, pointsForBooking, pointsValue, referralRewards } from '../../../common/logic/loyalty.util';

/** Loyalty: referral rewards (credited to wallet) + points earned on bookings, redeemable to wallet. */
@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(ReferralCode) private readonly codeRepo: Repository<ReferralCode>,
    @InjectRepository(ReferralRedemption) private readonly redRepo: Repository<ReferralRedemption>,
    @InjectRepository(PointsTransaction) private readonly pointsRepo: Repository<PointsTransaction>,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  /** Get (or lazily create) the user's referral code. */
  async myCode(userId: string): Promise<ReferralCode> {
    let c = await this.codeRepo.findOne({ where: { userId } });
    if (!c) c = await this.codeRepo.save(this.codeRepo.create({ userId, code: randomUUID().slice(0, 8).toUpperCase() }));
    return c;
  }

  /** A new user redeems a referral code: both sides get a wallet credit (once per referee). */
  async redeemReferral(refereeId: string, code: string) {
    const owner = await this.codeRepo.findOne({ where: { code: code.trim().toUpperCase() } });
    if (!owner) throw new AppException('INVALID_REFERRAL', 'Invalid referral code.', HttpStatus.NOT_FOUND);
    const guard = canRedeemReferral(owner.userId, refereeId);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    const already = await this.redRepo.findOne({ where: { refereeId } });
    if (already) throw new AppException('REFERRAL_USED', 'You have already used a referral code.', HttpStatus.CONFLICT);

    const rewards = referralRewards({
      referrerReward: this.config.get<number>('loyalty.referrerReward')!,
      refereeReward: this.config.get<number>('loyalty.refereeReward')!,
    });
    await this.redRepo.save(this.redRepo.create({ referrerId: owner.userId, refereeId, code: owner.code, referrerReward: rewards.referrer, refereeReward: rewards.referee }));
    // Rewards go straight to each wallet (wallet is enabled).
    await this.wallet.credit(owner.userId, rewards.referrer, 'REFERRAL_REWARD', refereeId);
    await this.wallet.credit(refereeId, rewards.referee, 'REFERRAL_BONUS', owner.userId);
    return { referrerReward: rewards.referrer, refereeReward: rewards.referee };
  }

  async pointsBalance(userId: string): Promise<number> {
    const rows = await this.pointsRepo.find({ where: { userId }, select: ['type', 'points'] });
    return rows.reduce((b, r) => b + (r.type === 'EARN' ? r.points : -r.points), 0);
  }

  async summary(userId: string) {
    return { points: await this.pointsBalance(userId), referralCode: (await this.myCode(userId)).code };
  }

  /** Earn points for a paid booking (called from the booking flow). */
  async earnForBooking(userId: string, bookingAmount: number, bookingId: string): Promise<number> {
    const pts = pointsForBooking(bookingAmount, this.config.get<number>('loyalty.pointsPerRupee')!);
    if (pts > 0) await this.pointsRepo.save(this.pointsRepo.create({ userId, type: 'EARN', points: pts, reason: 'BOOKING', referenceId: bookingId }));
    return pts;
  }

  /** Redeem points into wallet credit. */
  async redeemPoints(userId: string, points: number) {
    const bal = await this.pointsBalance(userId);
    if (points <= 0 || points > bal) throw new AppException('INSUFFICIENT_POINTS', 'Not enough points to redeem.', HttpStatus.BAD_REQUEST);
    const value = pointsValue(points, this.config.get<number>('loyalty.rupeePerPoint')!);
    await this.pointsRepo.save(this.pointsRepo.create({ userId, type: 'REDEEM', points, reason: 'REDEEM_TO_WALLET' }));
    await this.wallet.credit(userId, value, 'POINTS_REDEMPTION');
    return { redeemedPoints: points, walletCredited: value, pointsBalance: bal - points };
  }
}
