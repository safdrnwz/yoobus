import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoyaltyService } from './loyalty.service';

/**
 * Awards loyalty points when a booking is confirmed (decoupled from the booking flow).
 * Loyalty is available to every operator now (no plans), so points always accrue.
 */
@Injectable()
export class LoyaltyListener {
  private readonly logger = new Logger('LoyaltyListener');
  constructor(private readonly loyalty: LoyaltyService) {}

  @OnEvent('booking.confirmed')
  async onBookingConfirmed(payload: { userId: string; amount: number; bookingId: string; operatorId?: string }): Promise<void> {
    try {
      const pts = await this.loyalty.earnForBooking(payload.userId, payload.amount, payload.bookingId);
      if (pts > 0) this.logger.log(`Awarded ${pts} points to ${payload.userId} for booking ${payload.bookingId}`);
    } catch (e) {
      this.logger.error(`Points award failed: ${(e as Error).message}`);
    }
  }
}
