import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { BookingsService } from '../../booking/bookings/bookings.service';
import { AppException } from '../../../common/errors/app-exception';
import { canDebit, walletBalance } from '../../../common/logic/wallet.util';
import { UsersService } from '../users/users.service';
import { EmailService } from '../../integrations/email/email.service';
import { Logger } from '@nestjs/common';

/** Customer wallet: ledger-based balance, top-up, pay-with-wallet, and refunds-to-wallet. */
@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletTransaction) private readonly repo: Repository<WalletTransaction>,
    private readonly bookings: BookingsService,
    private readonly users: UsersService,
    private readonly email: EmailService,
  ) {}

  private readonly logger = new Logger('Wallet');

  async balance(userId: string): Promise<number> {
    const entries = await this.repo.find({ where: { userId }, select: ['type', 'amount'] });
    return walletBalance(entries);
  }

  history(userId: string) { return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 200 }); }

  async credit(userId: string, amount: number, reason: string, referenceId?: string): Promise<WalletTransaction> {
    if (amount <= 0) throw new AppException('INVALID_AMOUNT', 'Amount must be positive', HttpStatus.BAD_REQUEST);
    const tx = await this.repo.save(this.repo.create({ userId, type: 'CREDIT', amount, reason, referenceId: referenceId ?? null }));
    // Notify the customer for meaningful credits (top-up, referral, points, refund).
    const notable = ['TOPUP', 'REFERRAL_REWARD', 'REFERRAL_BONUS', 'POINTS_REDEMPTION', 'REFUND'];
    if (notable.includes(reason)) {
      try {
        const u = await this.users.findById(userId);
        if (u?.email) await this.email.send({ to: u.email, template: 'WALLET_CREDITED', vars: { name: u.fullName, amount, reason, balance: await this.balance(userId) }, operatorId: null });
      } catch (e) { this.logger.error(`Wallet-credit email failed: ${(e as Error).message}`); }
    }
    return tx;
  }

  async debit(userId: string, amount: number, reason: string, referenceId?: string): Promise<WalletTransaction> {
    const bal = await this.balance(userId);
    if (!canDebit(bal, amount)) throw new AppException('INSUFFICIENT_BALANCE', 'Insufficient wallet balance', HttpStatus.BAD_REQUEST);
    return this.repo.save(this.repo.create({ userId, type: 'DEBIT', amount, reason, referenceId: referenceId ?? null }));
  }

  async summary(userId: string) {
    return { balance: await this.balance(userId), transactions: await this.history(userId) };
  }

  /** Top-up (records a credit). Real money is collected via the payment gateway beforehand. */
  topup(userId: string, amount: number) { return this.credit(userId, amount, 'TOPUP'); }

  /** Pay a pending booking from the wallet, then confirm it. */
  async payBooking(userId: string, bookingId: string) {
    const booking = await this.bookings.findById(bookingId);
    if (booking.userId !== userId) throw new AppException('NOT_YOUR_BOOKING', 'This booking is not yours', HttpStatus.FORBIDDEN);
    const amount = Number(booking.payableByPassenger);
    await this.debit(userId, amount, 'BOOKING_PAYMENT', bookingId);
    const confirmed = await this.bookings.confirmPayment(bookingId);
    return { paid: true, amount, booking: { id: confirmed.id, pnr: confirmed.pnr, status: confirmed.status }, balance: await this.balance(userId) };
  }
}
