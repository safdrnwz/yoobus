import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Payment } from '../../finance/payments/entities/payment.entity';
import { Refund } from '../../finance/payments/entities/refund.entity';
import { Operator } from '../operators/entities/operator.entity';
import { User } from '../../customer/users/entities/user.entity';
import { EmailService } from '../../integrations/email/email.service';
import { OperatorStatus } from '../../../common/enums/operator-status.enum';
import { Role } from '../../../common/enums/role.enum';

interface DayWindow { start: Date; end: Date; label: string; }
const money = (n: any) => Math.round(Number(n || 0) * 100) / 100;

/** Builds and emails each operator's daily booking + finance statement. */
@Injectable()
export class DailyStatementService {
  private readonly logger = new Logger('DailyStatement');

  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(Operator) private readonly operatorRepo: Repository<Operator>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly email: EmailService,
  ) {}

  /** Previous calendar day [00:00, next 00:00). */
  private yesterdayWindow(ref = new Date()): DayWindow {
    const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    const label = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return { start, end, label };
  }

  /** Aggregate bookings by operator + status in one grouped query (scales to many operators). */
  private async bookingAgg(w: DayWindow) {
    const rows = await this.bookingRepo.createQueryBuilder('b')
      .select('b.operatorId', 'operatorId')
      .addSelect('b.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(b.payableByPassenger),0)', 'gross')
      .addSelect('COALESCE(SUM(b.commissionBase),0)', 'commissionBase')
      .addSelect('COALESCE(SUM(b.commissionGst),0)', 'commissionGst')
      .addSelect('COALESCE(SUM(b.tcs),0)', 'tcs')
      .addSelect('COALESCE(SUM(b.tds),0)', 'tds')
      .addSelect('COALESCE(SUM(b.operatorNet),0)', 'operatorNet')
      .where('b.createdAt >= :start AND b.createdAt < :end', { start: w.start, end: w.end })
      .groupBy('b.operatorId').addGroupBy('b.status')
      .getRawMany();
    return rows;
  }

  private async paymentAgg(w: DayWindow) {
    return this.paymentRepo.createQueryBuilder('p')
      .innerJoin(Booking, 'b', 'b.id = p.bookingId')
      .select('b.operatorId', 'operatorId')
      .addSelect('p.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(p.amount),0)', 'amount')
      .where('p.createdAt >= :start AND p.createdAt < :end', { start: w.start, end: w.end })
      .groupBy('b.operatorId').addGroupBy('p.status')
      .getRawMany();
  }

  private async refundAgg(w: DayWindow) {
    return this.refundRepo.createQueryBuilder('r')
      .innerJoin(Booking, 'b', 'b.id = r.bookingId')
      .select('b.operatorId', 'operatorId')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(r.refundAmount),0)', 'amount')
      .where('r.createdAt >= :start AND r.createdAt < :end', { start: w.start, end: w.end })
      .groupBy('b.operatorId')
      .getRawMany();
  }

  /** Runs the statement for the given reference day (defaults to now → yesterday). */
  async run(ref = new Date()): Promise<{ operators: number; window: string }> {
    const w = this.yesterdayWindow(ref);
    const [bAgg, pAgg, rAgg, operators] = await Promise.all([
      this.bookingAgg(w), this.paymentAgg(w), this.refundAgg(w),
      this.operatorRepo.find({ where: { status: OperatorStatus.ACTIVE } }),
    ]);

    let sent = 0;
    for (const op of operators) {
      const bookings = bAgg.filter((x) => x.operatorId === op.id);
      const payments = pAgg.filter((x) => x.operatorId === op.id);
      const refunds = rAgg.filter((x) => x.operatorId === op.id);

      const byStatus = (s: string) => bookings.find((x) => x.status === s) || {};
      const confirmed = byStatus('CONFIRMED');
      const cancelled = byStatus('CANCELLED');
      const pending = byStatus('PENDING');
      const totalBookings = bookings.reduce((a, x) => a + Number(x.cnt), 0);
      const paySuccess = payments.find((x) => x.status === 'SUCCESS') || {};
      const refundTotal = refunds[0] || {};

      // Skip operators with zero activity for the day.
      if (totalBookings === 0 && !paySuccess.cnt && !refundTotal.cnt) continue;

      const commissionBase = money(confirmed.commissionBase);
      const commissionGst = money(confirmed.commissionGst);
      const tcs = money(confirmed.tcs);
      const tds = money(confirmed.tds);
      const platformCharge = money(commissionBase + commissionGst + tcs + tds);
      const operatorNet = money(confirmed.operatorNet);

      const vars = {
        operatorName: op.brandName || op.legalName,
        date: w.label,
        confirmedCount: Number(confirmed.cnt || 0),
        cancelledCount: Number(cancelled.cnt || 0),
        pendingCount: Number(pending.cnt || 0),
        totalBookings,
        grossSales: money(confirmed.gross),
        paymentsCount: Number(paySuccess.cnt || 0),
        paymentsAmount: money(paySuccess.amount),
        refundsCount: Number(refundTotal.cnt || 0),
        refundsAmount: money(refundTotal.amount),
        commissionBase, commissionGst, tcs, tds, platformCharge, operatorNet,
      };

      // Send to every operator admin; fall back to the operator's registered email.
      const admins = await this.userRepo.find({ where: { operatorId: op.id, role: Role.OPERATOR_ADMIN } });
      const recipients = admins.length ? admins.map((a) => a.email) : (op.email ? [op.email] : []);
      for (const to of recipients) {
        await this.email.send({ to, template: 'OPERATOR_DAILY_STATEMENT', vars, operatorId: op.id, recipientOperatorId: op.id });
        sent++;
      }
    }
    this.logger.log(`Daily statement for ${w.label}: ${sent} email(s) across ${operators.length} active operator(s)`);
    return { operators: operators.length, window: w.label };
  }
}
