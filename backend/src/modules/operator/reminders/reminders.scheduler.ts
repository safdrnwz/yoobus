import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Route } from '../routes/entities/route.entity';
import { User } from '../../customer/users/entities/user.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { TripStatus } from '../../../common/enums/trip-status.enum';
import { EmailService } from '../../integrations/email/email.service';

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

/** Time-based passenger reminders: pending payment, upcoming trip, and post-trip review. */
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger('Reminders');
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly email: EmailService,
  ) {}

  private async emailUser(userId: string, template: string, vars: Record<string, any>) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (u?.email) await this.email.send({ to: u.email, template, vars: { name: u.fullName, operatorName: 'Yoo Bus', ...vars }, operatorId: null });
  }

  /** stopId -> stop name for a route (routeStops + stop are eager). Cached per tick. */
  private async stopNames(routeId: string, cache: Map<string, Map<string, string>>): Promise<Map<string, string>> {
    if (cache.has(routeId)) return cache.get(routeId)!;
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    const m = new Map<string, string>();
    for (const rs of route?.routeStops ?? []) m.set(rs.stopId, rs.stop?.name ?? '');
    cache.set(routeId, m);
    return m;
  }

  /** trip cache: tripId -> trip (for resolving a booking's route). */
  private async tripOf(tripId: string, cache: Map<string, Trip | null>): Promise<Trip | null> {
    if (cache.has(tripId)) return cache.get(tripId)!;
    const t = await this.tripRepo.findOne({ where: { id: tripId } });
    cache.set(tripId, t);
    return t;
  }

  /** Every day 10:00 — remind passengers whose booking is still awaiting payment. */
  @Cron('0 10 * * *', { name: 'payment-reminder', timeZone: 'Asia/Kolkata' })
  async paymentReminders(): Promise<void> {
    try {
      const pending = await this.bookingRepo.find({ where: { status: BookingStatus.PENDING }, take: 2000 });
      const tCache = new Map<string, Trip | null>(); const sCache = new Map<string, Map<string, string>>();
      for (const b of pending) {
        const t = await this.tripOf(b.tripId, tCache);
        const names = t ? await this.stopNames(t.routeId, sCache) : new Map<string, string>();
        await this.emailUser(b.userId, 'PAYMENT_REMINDER', { from: names.get(b.boardingStopId) ?? '', to: names.get(b.droppingStopId) ?? '' });
      }
      this.logger.log(`Payment reminders: ${pending.length}`);
    } catch (e) { this.logger.error(`Payment reminders failed: ${(e as Error).message}`); }
  }

  /** Every day 18:00 — remind passengers about trips departing tomorrow. */
  @Cron('0 18 * * *', { name: 'trip-reminder', timeZone: 'Asia/Kolkata' })
  async tripReminders(): Promise<void> {
    try {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const trips = await this.tripRepo.find({ where: { departureDate: dateStr(tomorrow), status: TripStatus.SCHEDULED } });
      const sCache = new Map<string, Map<string, string>>();
      let n = 0;
      for (const t of trips) {
        const names = await this.stopNames(t.routeId, sCache);
        const bookings = await this.bookingRepo.find({ where: { tripId: t.id, status: BookingStatus.CONFIRMED } });
        for (const b of bookings) {
          const from = names.get(b.boardingStopId) ?? '';
          await this.emailUser(b.userId, 'TRIP_REMINDER', { pnr: b.pnr, date: t.departureDate, time: t.departureTime, from, to: names.get(b.droppingStopId) ?? '', boarding: from }); n++;
        }
      }
      this.logger.log(`Trip reminders: ${n} across ${trips.length} trip(s)`);
    } catch (e) { this.logger.error(`Trip reminders failed: ${(e as Error).message}`); }
  }

  /** Every day 12:00 — ask passengers of yesterday's trips to leave a review. */
  @Cron('0 12 * * *', { name: 'review-request', timeZone: 'Asia/Kolkata' })
  async reviewRequests(): Promise<void> {
    try {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const trips = await this.tripRepo.find({ where: { departureDate: dateStr(yesterday) } });
      let n = 0;
      for (const t of trips) {
        const bookings = await this.bookingRepo.find({ where: { tripId: t.id, status: BookingStatus.CONFIRMED } });
        for (const b of bookings) { await this.emailUser(b.userId, 'REVIEW_REQUEST', {}); n++; }
      }
      this.logger.log(`Review requests: ${n} across ${trips.length} trip(s)`);
    } catch (e) { this.logger.error(`Review requests failed: ${(e as Error).message}`); }
  }
}
