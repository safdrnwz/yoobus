import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Refund } from '../payments/entities/refund.entity';
import { Settlement } from '../settlements/entities/settlement.entity';
import { SetupInvoice } from '../billing/entities/setup-invoice.entity';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { MessagingUsage } from '../../integrations/messaging/entities/messaging-usage.entity';
import { EmailLog } from '../../integrations/email/email-log.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';

const money = (n: any) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Operator finance control panel: revenue, GST, commission, payments, refunds, settlements —
 * plus this operator's PLATFORM BILLING (their own commercial terms, set by the SuperAdmin):
 * one-time platform fee, per-bus setup fees, per-ticket commission, and communication charges
 * (SMS / WhatsApp / email billed PER MESSAGE at this operator's own rates).
 */
@Injectable()
export class FinanceSummaryService {
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(Settlement) private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SetupInvoice) private readonly invoiceRepo: Repository<SetupInvoice>,
    @InjectRepository(Operator) private readonly operatorRepo: Repository<Operator>,
    @InjectRepository(MessagingUsage) private readonly usageRepo: Repository<MessagingUsage>,
    @InjectRepository(EmailLog) private readonly emailRepo: Repository<EmailLog>,
  ) {}

  /** YYYY-MM to bill comms for: the range's `from` month, else the current month. */
  private ymOf(range?: { from?: string }): string {
    const d = range?.from ? new Date(range.from + 'T00:00:00') : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Communication charges billed to the operator for a month = messages actually sent × this
   * operator's own per-message rate, for SMS, WhatsApp and email.
   */
  async commsCharges(operator: Operator, range?: { from?: string; to?: string }) {
    const ym = this.ymOf(range);
    const start = new Date(ym + '-01T00:00:00');
    const end = new Date(start); end.setMonth(end.getMonth() + 1);

    const [smsRow, waRow, emailCount] = await Promise.all([
      this.usageRepo.findOne({ where: { operatorId: operator.id, yearMonth: ym, channel: 'SMS' } }),
      this.usageRepo.findOne({ where: { operatorId: operator.id, yearMonth: ym, channel: 'WHATSAPP' } }),
      this.emailRepo.count({ where: { operatorId: operator.id, status: In(['SENT', 'DEV']), createdAt: Between(start, end) } }),
    ]);

    const smsCount = smsRow?.count ?? 0;
    const waCount = waRow?.count ?? 0;
    const smsRate = Number(operator.smsCharge ?? 0);
    const waRate = Number(operator.whatsappCharge ?? 0);
    const emailRate = Number(operator.emailCharge ?? 0);

    const rows = {
      sms: { messages: smsCount, ratePerMessage: smsRate, amount: money(smsCount * smsRate) },
      whatsapp: { messages: waCount, ratePerMessage: waRate, amount: money(waCount * waRate) },
      email: { messages: emailCount, ratePerMessage: emailRate, amount: money(emailCount * emailRate) },
    };
    return { month: ym, ...rows, total: money(rows.sms.amount + rows.whatsapp.amount + rows.email.amount) };
  }

  async operatorSummary(operatorId: string, range?: { from?: string; to?: string }) {
    const where: any = { operatorId, status: BookingStatus.CONFIRMED };
    if (range?.from) {
      const start = new Date(range.from + 'T00:00:00');
      const end = range.to ? new Date(range.to + 'T23:59:59') : new Date();
      where.createdAt = Between(start, end);
    }
    const [operator, confirmed, refunds, settlements, pendingSettlements, pendingInvoices] = await Promise.all([
      this.operatorRepo.findOne({ where: { id: operatorId } }),
      this.bookingRepo.find({ where, select: ['baseFare', 'fareGst', 'commissionBase', 'commissionGst', 'tcs', 'tds', 'operatorNet', 'payableByPassenger'] }),
      this.refundRepo.createQueryBuilder('r').innerJoin(Booking, 'b', 'b.id = r."bookingId"').where('b."operatorId" = :operatorId', { operatorId }).select(['r."refundAmount" AS "refundAmount"', 'r.mode AS mode', 'r.status AS status']).getRawMany().catch(() => [] as any[]),
      this.settlementRepo.find({ where: { operatorId, status: 'PAID' }, select: ['payout'] }),
      this.settlementRepo.find({ where: { operatorId, status: Not('PAID') }, select: ['payout'] }),
      this.invoiceRepo.find({ where: { operatorId, status: Not('PAID') as any }, select: ['amount'] }).catch(() => [] as any[]),
    ]);

    const sum = (rows: any[], k: string) => money(rows.reduce((s, r) => s + Number(r[k] || 0), 0));
    const revenue = {
      grossCollected: sum(confirmed, 'payableByPassenger'),
      baseFare: sum(confirmed, 'baseFare'),
      fareGst: sum(confirmed, 'fareGst'),
      operatorNet: sum(confirmed, 'operatorNet'),
      bookings: confirmed.length,
    };
    const platform = {
      commission: money(sum(confirmed, 'commissionBase') + sum(confirmed, 'commissionGst')),
      commissionBase: sum(confirmed, 'commissionBase'),
      commissionGst: sum(confirmed, 'commissionGst'),
      tcs: sum(confirmed, 'tcs'),
      tds: sum(confirmed, 'tds'),
    };
    const refundsToWallet = refunds.filter((r) => r.mode === 'WALLET');
    const refundsToSource = refunds.filter((r) => r.mode === 'SOURCE');

    const comms = operator ? await this.commsCharges(operator, range) : null;

    return {
      range: range?.from ? { from: range.from, to: range.to ?? 'now' } : 'all-time',
      revenue,
      platformCharges: platform,
      refunds: {
        total: money(sum(refunds, 'refundAmount')), count: refunds.length,
        toWallet: money(sum(refundsToWallet, 'refundAmount')),
        toSource: money(sum(refundsToSource, 'refundAmount')),
      },
      settlements: {
        paidOut: sum(settlements, 'payout'), paidCount: settlements.length,
        pendingPayout: sum(pendingSettlements, 'payout'), pendingCount: pendingSettlements.length,
      },
      setupInvoices: { pendingAmount: sum(pendingInvoices, 'amount'), pendingCount: pendingInvoices.length },
      // The operator's own commercial terms (set by the SuperAdmin) and what they add up to.
      platformBilling: operator ? {
        commissionRate: Number(operator.commissionRate ?? 0),
        oneTimePlatformFee: money(operator.oneTimePlatformFee),
        setupFeePerBus: money(operator.setupFeePerBus),
        commsCharges: comms,
        extraCharges: operator.extraCharges ?? {},
      } : null,
    };
  }
}
