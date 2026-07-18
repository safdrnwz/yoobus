import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { Trip } from '../trips/entities/trip.entity';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Bus } from '../buses/entities/bus.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Settlement } from '../../finance/settlements/entities/settlement.entity';
import { SupportTicket } from '../support-crm/entities/support.entities';
import { DisruptionEvent } from '../disruption/entities/disruption-event.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { TripStatus } from '../../../common/enums/trip-status.enum';
import { ScorecardService } from '../scorecard/scorecard.service';

const money = (n: any) => Math.round(Number(n || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

/** Operator control panel: one call that integrates trips, bookings, revenue, fleet,
 *  settlements, support, disruptions and the SLA scorecard for a single operator. */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Settlement) private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(DisruptionEvent) private readonly disruptionRepo: Repository<DisruptionEvent>,
    private readonly scorecard: ScorecardService,
  ) {}

  async overview(operatorId: string, range?: { from?: string; to?: string }) {
    const day = range?.from ?? today();
    const dayStart = new Date((range?.from ?? today()) + 'T00:00:00');
    const dayEnd = range?.to ? new Date(range.to + 'T23:59:59') : (() => { const d = new Date(dayStart); d.setDate(d.getDate() + 1); return d; })();

    const [
      tripsToday, tripsRunning,
      bookingsToday, confirmedToday,
      totalBookings, confirmedTotal, cancelledTotal,
      activeBuses, activeDrivers,
      pendingSettlements, openTickets, activeDisruptions,
      scorecard,
    ] = await Promise.all([
      this.tripRepo.count({ where: { operatorId, departureDate: day } }),
      this.tripRepo.count({ where: { operatorId, status: TripStatus.RUNNING } }),
      this.bookingRepo.count({ where: { operatorId, createdAt: Between(dayStart, dayEnd) } }),
      this.bookingRepo.find({ where: { operatorId, status: BookingStatus.CONFIRMED, createdAt: Between(dayStart, dayEnd) }, select: ['payableByPassenger', 'operatorNet'] }),
      this.bookingRepo.count({ where: { operatorId } }),
      this.bookingRepo.count({ where: { operatorId, status: BookingStatus.CONFIRMED } }),
      this.bookingRepo.count({ where: { operatorId, status: BookingStatus.CANCELLED } }),
      this.busRepo.count({ where: { operatorId, isActive: true } }),
      this.driverRepo.count({ where: { operatorId, isActive: true } }),
      this.settlementRepo.find({ where: { operatorId, status: Not('PAID') }, select: ['payout'] }),
      this.ticketRepo.count({ where: { operatorId, status: In(['OPEN', 'ASSIGNED']) } }),
      this.disruptionRepo.count({ where: { operatorId, status: 'OPEN' } }),
      this.scorecard.forOperator(operatorId).catch(() => null),
    ]);

    const revenueToday = money(confirmedToday.reduce((s, b) => s + Number(b.payableByPassenger), 0));
    const netToday = money(confirmedToday.reduce((s, b) => s + Number((b as any).operatorNet ?? 0), 0));
    const pendingPayout = money(pendingSettlements.reduce((s, x) => s + Number(x.payout), 0));

    return {
      date: day,
      trips: { today: tripsToday, running: tripsRunning },
      bookings: { today: bookingsToday, confirmedToday: confirmedToday.length, total: totalBookings, confirmedTotal, cancelledTotal },
      revenue: { today: revenueToday, netToday, pendingPayout },
      fleet: { activeBuses, activeDrivers },
      support: { openTickets, activeDisruptions },
      sla: scorecard ? { score: (scorecard as any).score, grade: (scorecard as any).grade } : null,
    };
  }
}
