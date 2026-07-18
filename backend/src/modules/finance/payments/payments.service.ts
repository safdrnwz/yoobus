import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { BookingsService } from '../../booking/bookings/bookings.service';
import { AppException } from '../../../common/errors/app-exception';
import { toPaise, verifyRazorpaySignature } from '../../../common/logic/razorpay.util';
import { UsersService } from '../../customer/users/users.service';
import { EmailService } from '../../integrations/email/email.service';

const RZP_BASE = 'https://api.razorpay.com/v1';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    @InjectRepository(Payment) private readonly payRepo: Repository<Payment>,
    private readonly bookings: BookingsService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly email: EmailService,
  ) {}

  /** Fire-and-forget customer email; a mail failure never breaks the payment flow. */
  private async notify(userId: string, template: string, vars: Record<string, any>) {
    try {
      const u = await this.users.findById(userId);
      if (u?.email) await this.email.send({ to: u.email, template, vars: { name: u.fullName, operatorName: 'Yoo Bus', ...vars }, operatorId: null });
    } catch (e) {
      this.logger.error(`Email ${template} failed: ${(e as Error).message}`);
    }
  }

  private creds(): { keyId: string; keySecret: string } {
    const keyId = this.config.get<string>('razorpay.keyId');
    const keySecret = this.config.get<string>('razorpay.keySecret');
    if (!keyId || !keySecret) {
      throw new AppException('RAZORPAY_NOT_CONFIGURED', 'Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { keyId, keySecret };
  }

  private authHeader(): string {
    const { keyId, keySecret } = this.creds();
    return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  }

  /** STEP 1 — create a Razorpay order for a booking. Returns data the frontend checkout needs. */
  async createOrder(userId: string, bookingId: string) {
    const booking = await this.bookings.findById(bookingId);
    if (booking.userId !== userId) throw new AppException('NOT_YOUR_BOOKING', 'This booking does not belong to you', HttpStatus.FORBIDDEN);
    const amountPaise = toPaise(Number(booking.payableByPassenger));
    if (amountPaise < 100) throw new AppException('AMOUNT_TOO_LOW', 'Amount must be at least 1 INR (100 paise).', HttpStatus.BAD_REQUEST);

    let order: any;
    try {
      const res = await fetch(`${RZP_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
        body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: `bk_${booking.id}`, notes: { bookingId: booking.id, pnr: booking.pnr } }),
      });
      if (res.status === 401) throw new AppException('RAZORPAY_AUTH', 'Payment gateway authentication failed.', HttpStatus.UNAUTHORIZED);
      if (!res.ok) { this.logger.error(`Razorpay order failed: ${res.status}`); throw new AppException('RAZORPAY_ORDER_FAILED', 'Could not create payment order.', HttpStatus.INTERNAL_SERVER_ERROR); }
      order = await res.json();
    } catch (e) {
      if (e instanceof AppException) throw e;
      this.logger.error(`Razorpay order error: ${(e as Error).message}`);
      throw new AppException('RAZORPAY_ORDER_FAILED', 'Could not reach the payment gateway.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    await this.payRepo.save(this.payRepo.create({
      bookingId: booking.id, amount: Number(booking.payableByPassenger), gateway: 'RAZORPAY',
      status: 'PENDING', reference: order.id, razorpayOrderId: order.id,
    }));
    // KEY_SECRET never leaves the server — only the public keyId goes to the client.
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: this.config.get<string>('razorpay.keyId'), bookingId: booking.id, pnr: booking.pnr };
  }

  /** STEP 3 — verify the signature and, only on success, confirm the booking. */
  async verifyPayment(userId: string, dto: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const { keySecret } = this.creds();
    const payment = await this.payRepo.findOne({ where: { razorpayOrderId: dto.razorpay_order_id } });
    if (!payment) throw new AppException('PAYMENT_NOT_FOUND', 'No matching order found.', HttpStatus.NOT_FOUND);
    const booking = await this.bookings.findById(payment.bookingId);
    if (booking.userId !== userId) throw new AppException('NOT_YOUR_BOOKING', 'This booking does not belong to you', HttpStatus.FORBIDDEN);

    const valid = verifyRazorpaySignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature, keySecret);
    if (!valid) {
      payment.status = 'FAILED';
      await this.payRepo.save(payment);
      await this.notify(booking.userId, 'PAYMENT_FAILED', { pnr: booking.pnr });
      throw new AppException('SIGNATURE_MISMATCH', 'Payment verification failed.', HttpStatus.BAD_REQUEST);
    }
    payment.status = 'SUCCESS';
    payment.razorpayPaymentId = dto.razorpay_payment_id;
    payment.signatureVerified = true;
    await this.payRepo.save(payment);

    const confirmed = await this.bookings.confirmPayment(booking.id);
    await this.notify(booking.userId, 'PAYMENT_SUCCESS', { pnr: confirmed.pnr, amount: Number(payment.amount) });
    return { verified: true, paymentId: payment.id, booking: { id: confirmed.id, pnr: confirmed.pnr, status: confirmed.status } };
  }

  /** Refund a captured payment back to its original source (used by cancellations). */
  async refundToSource(bookingId: string, amountRupees: number) {
    const payment = await this.payRepo.findOne({ where: { bookingId, status: 'SUCCESS' } });
    if (!payment?.razorpayPaymentId) return { refunded: false, reason: 'No captured online payment to refund.' };
    try {
      const res = await fetch(`${RZP_BASE}/payments/${payment.razorpayPaymentId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
        body: JSON.stringify({ amount: toPaise(amountRupees) }),
      });
      if (!res.ok) { this.logger.error(`Razorpay refund failed: ${res.status}`); return { refunded: false, reason: 'Gateway refund failed.' }; }
      const refund = await res.json();
      payment.status = 'REFUNDED';
      await this.payRepo.save(payment);
      try {
        const booking = await this.bookings.findById(bookingId);
        await this.notify(booking.userId, 'REFUND_PROCESSED', { pnr: booking.pnr, refundAmount: amountRupees, cancellationCharge: 0 });
      } catch (e) { this.logger.error(`Refund email failed: ${(e as Error).message}`); }
      return { refunded: true, refundId: refund.id };
    } catch (e) {
      this.logger.error(`Razorpay refund error: ${(e as Error).message}`);
      return { refunded: false, reason: 'Could not reach the payment gateway.' };
    }
  }
}
