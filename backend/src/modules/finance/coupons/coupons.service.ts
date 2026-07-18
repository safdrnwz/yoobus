import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, CouponRedemption } from './entities/coupon.entities';
import { CreateCouponDto } from './dto/coupon.dto';
import { AppException } from '../../../common/errors/app-exception';
import { computeCouponDiscount, validateCoupon } from '../../../common/logic/coupon.util';

/** Coupons / promo codes with total + per-user limits, date windows and operator scoping. */
@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon) private readonly repo: Repository<Coupon>,
    @InjectRepository(CouponRedemption) private readonly redRepo: Repository<CouponRedemption>,
  ) {}

  async create(operatorId: string | null, dto: CreateCouponDto): Promise<Coupon> {
    return this.repo.save(this.repo.create({
      code: dto.code.trim().toUpperCase(), operatorId: operatorId ?? null, type: dto.type, value: dto.value,
      maxDiscount: dto.maxDiscount ?? null, minFare: dto.minFare ?? null,
      usageLimit: dto.usageLimit ?? null, perUserLimit: dto.perUserLimit ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null, validTo: dto.validTo ? new Date(dto.validTo) : null,
      active: dto.active ?? true,
    }));
  }

  list(operatorId?: string | null): Promise<Coupon[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  private async load(code: string): Promise<Coupon> {
    const c = await this.repo.findOne({ where: { code: code.trim().toUpperCase() } });
    if (!c) throw new AppException('COUPON_NOT_FOUND', 'Invalid coupon code.', HttpStatus.NOT_FOUND);
    return c;
  }

  /** Validate + quote a discount for a fare (no side effects). userId optional for per-user checks. */
  async quote(code: string, fare: number, userId?: string, operatorId?: string | null) {
    const c = await this.load(code);
    if (c.operatorId && operatorId && c.operatorId !== operatorId) {
      throw new AppException('COUPON_NOT_APPLICABLE', 'This coupon is not valid for this operator.', HttpStatus.BAD_REQUEST);
    }
    const userUsedCount = userId ? await this.redRepo.count({ where: { couponId: c.id, userId } }) : 0;
    const check = validateCoupon({
      active: c.active, validFromMs: c.validFrom?.getTime() ?? null, validToMs: c.validTo?.getTime() ?? null,
      minFare: c.minFare != null ? Number(c.minFare) : null, usageLimit: c.usageLimit, usedCount: c.usedCount,
      perUserLimit: c.perUserLimit, userUsedCount, type: c.type, value: Number(c.value),
    }, fare, Date.now());
    if (!check.ok) throw new AppException(check.code!, check.message!, HttpStatus.BAD_REQUEST);
    const discount = computeCouponDiscount(fare, c.type, Number(c.value), c.maxDiscount != null ? Number(c.maxDiscount) : null);
    return { code: c.code, couponId: c.id, discount, payable: Math.round((fare - discount) * 100) / 100 };
  }

  /** Records a redemption and increments the usage counter. Call after a successful booking. */
  async redeem(couponId: string, userId: string, bookingId: string, discountAmount: number): Promise<void> {
    await this.redRepo.save(this.redRepo.create({ couponId, userId, bookingId, discountAmount }));
    await this.repo.increment({ id: couponId }, 'usedCount', 1);
  }
}
