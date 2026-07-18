import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatAvailabilityWatch } from './entities/seat-availability-watch.entity';
import { CreateSeatAlertDto } from './dto/seat-alert.dto';
import { TripsService } from '../../operator/trips/trips.service';
import { EmailService } from '../../integrations/email/email.service';
import { MessagingService } from '../../integrations/messaging/messaging.service';
import { AppException } from '../../../common/errors/app-exception';

/**
 * "Tell me when a seat opens up" — NOT a waitlist (no auto-booking, no queue).
 * A shopper who saw a full bus registers interest; when a cancellation frees a seat
 * on their exact segment, everyone watching is pinged over email + SMS + WhatsApp.
 */
@Injectable()
export class SeatAlertService {
  private readonly logger = new Logger('SeatAlert');
  constructor(
    @InjectRepository(SeatAvailabilityWatch) private readonly repo: Repository<SeatAvailabilityWatch>,
    private readonly trips: TripsService,
    private readonly email: EmailService,
    private readonly messaging: MessagingService,
  ) {}

  /** Register interest. Only makes sense when the segment is currently full. */
  async watch(tripId: string, dto: CreateSeatAlertDto, userId?: string) {
    const avail = await this.trips.getSeatAvailability(tripId, dto.boardingStopId, dto.droppingStopId);
    if (avail.availableCount > 0) {
      // Nothing to wait for — seats are already open.
      return { watching: false, availableCount: avail.availableCount, message: 'Seats are available right now — you can book directly.' };
    }
    // De-dupe: one active watch per email+segment.
    const existing = await this.repo.findOne({ where: { tripId, email: dto.email, boardingStopId: dto.boardingStopId, droppingStopId: dto.droppingStopId, status: 'WATCHING' } });
    if (existing) return { watching: true, id: existing.id, message: 'You are already on the alert list for this trip.' };
    const w = await this.repo.save(this.repo.create({
      userId: userId ?? null, email: dto.email, phone: dto.phone ?? null,
      tripId, boardingStopId: dto.boardingStopId, droppingStopId: dto.droppingStopId, status: 'WATCHING',
    }));
    return { watching: true, id: w.id, message: "We'll alert you the moment a seat opens up." };
  }

  /**
   * Called after a cancellation frees seats on a trip. Notifies every watcher whose
   * segment now has availability, then marks them notified (one-shot).
   */
  async notifyWatchers(tripId: string): Promise<{ notified: number }> {
    let notified = 0;
    try {
      const watches = await this.repo.find({ where: { tripId, status: 'WATCHING' } });
      if (!watches.length) return { notified: 0 };
      // Cache availability per unique segment to avoid recomputing.
      const cache = new Map<string, any>();
      for (const w of watches) {
        const key = `${w.boardingStopId}|${w.droppingStopId}`;
        let avail = cache.get(key);
        if (!avail) { avail = await this.trips.getSeatAvailability(tripId, w.boardingStopId, w.droppingStopId); cache.set(key, avail); }
        if (avail.availableCount <= 0) continue;

        const from = avail.fromName ?? '', to = avail.toName ?? '';
        const vars = { name: w.email.split('@')[0], from, to, date: avail.date ?? '', operatorName: 'Yoo Bus', availableCount: avail.availableCount, bookUrl: `https://app.yoobus.com/trips/${tripId}` };
        try { await this.email.send({ to: w.email, template: 'SEAT_AVAILABLE_ALERT', vars, operatorId: null }); } catch (e) { this.logger.error(`Alert email failed: ${(e as Error).message}`); }
        if (w.phone) {
          const msg = `Yoo Bus: A seat just opened up on your trip! ${avail.availableCount} seat(s) available now. Book fast: ${vars.bookUrl}`;
          try { await this.messaging.notify(w.phone, msg, { operatorId: avail.operatorId ?? null, key: 'SEAT_AVAILABLE_ALERT' }); } catch (e) { this.logger.error(`Alert SMS failed: ${(e as Error).message}`); }
        }
        w.status = 'NOTIFIED'; w.notifiedAt = new Date();
        await this.repo.save(w);
        notified++;
      }
      this.logger.log(`Seat-available alerts sent: ${notified} for trip ${tripId}`);
    } catch (e) {
      this.logger.error(`notifyWatchers failed: ${(e as Error).message}`);
    }
    return { notified };
  }
}
