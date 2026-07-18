import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WalletService } from './wallet.service';

/** Credits a cancellation refund to the customer's wallet (decoupled from the booking flow). */
@Injectable()
export class WalletRefundListener {
  private readonly logger = new Logger('WalletRefund');
  constructor(private readonly wallet: WalletService) {}

  @OnEvent('booking.refund.wallet')
  async onWalletRefund(payload: { userId: string; amount: number; bookingId: string }): Promise<void> {
    try {
      await this.wallet.credit(payload.userId, payload.amount, 'REFUND', payload.bookingId);
      this.logger.log(`Refund of ${payload.amount} credited to wallet for ${payload.userId}`);
    } catch (e) { this.logger.error(`Wallet refund failed: ${(e as Error).message}`); }
  }
}
