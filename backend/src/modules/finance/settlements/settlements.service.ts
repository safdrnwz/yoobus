import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Settlement } from './entities/settlement.entity';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Refund } from '../payments/entities/refund.entity';
import { Logger } from '@nestjs/common';
import { User } from '../../customer/users/entities/user.entity';
import { Role } from '../../../common/enums/role.enum';
import { EmailService } from '../../integrations/email/email.service';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { computePayout } from '../../../common/logic/settlement.util';
import { AppException } from '../../../common/errors/app-exception';

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger('Settlements');
  constructor(
    @InjectRepository(Settlement) private readonly setRepo: Repository<Settlement>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly email: EmailService,
  ) {}

  // Operator payout for a period (collection - commission - tax - refunds)
  async compute(operatorId: string, from: string, to: string) {
    const confirmed = await this.bookingRepo.find({
      where: { operatorId, status: BookingStatus.CONFIRMED, createdAt: Between(new Date(from), new Date(to + 'T23:59:59')) },
    });
    const sum = (f: (b: Booking) => number) => confirmed.reduce((s, b) => s + Number(f(b)), 0);
    const collectedBaseFare = sum((b) => Number(b.baseFare));
    const commissionBase = sum((b) => Number(b.commissionBase));
    const commissionGst = sum((b) => Number(b.commissionGst));
    const tcs = sum((b) => Number(b.tcs));
    const tds = sum((b) => Number(b.tds));
    const refunds = await this.refundRepo.find();
    const refundsPaid = refunds.filter((r) => confirmed.some((b) => b.id === r.bookingId)).reduce((s, r) => s + Number(r.refundAmount), 0);
    const { payout, platformEarning } = computePayout({ collectedBaseFare, commissionBase, commissionGst, tcs, tds, refundsPaid });
    return { operatorId, periodFrom: from, periodTo: to, collectedBaseFare, platformEarning, refundsPaid, payout, bookings: confirmed.length };
  }

  async createSettlement(operatorId: string, from: string, to: string) {
    const c = await this.compute(operatorId, from, to);
    return this.setRepo.save(this.setRepo.create({
      operatorId, periodFrom: from, periodTo: to, collectedBaseFare: c.collectedBaseFare,
      platformEarning: c.platformEarning, refundsPaid: c.refundsPaid, payout: c.payout, status: 'PENDING',
    }));
  }

  list(operatorId: string) { return this.setRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' } }); }

  async markPaid(id: string) {
    const s = await this.setRepo.findOne({ where: { id } });
    if (!s) throw new AppException('SETTLEMENT_NOT_FOUND', 'Settlement not found', HttpStatus.NOT_FOUND);
    s.status = 'PAID';
    const saved = await this.setRepo.save(s);
    try {
      const admins = await this.userRepo.find({ where: { operatorId: s.operatorId, role: Role.OPERATOR_ADMIN } });
      for (const a of admins) await this.email.send({ to: a.email, template: 'SETTLEMENT_PAID', vars: { operatorName: a.fullName, payout: Number(s.payout), periodFrom: s.periodFrom, periodTo: s.periodTo }, operatorId: s.operatorId, recipientOperatorId: s.operatorId });
    } catch (e) { this.logger.error(`Settlement email failed: ${(e as Error).message}`); }
    return saved;
  }
}
