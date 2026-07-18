import { Injectable } from '@nestjs/common';
import { ScorecardService } from '../../operator/scorecard/scorecard.service';
import { User } from '../../customer/users/entities/user.entity';
import { Role } from '../../../common/enums/role.enum';
import { OperatorStatus } from '../../../common/enums/operator-status.enum';
import { SupportTicket } from '../../operator/support-crm/entities/support.entities';
import { Settlement } from '../../finance/settlements/entities/settlement.entity';
import { In, Not, Between } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';

/** Advanced analytics dashboards (Phase 4). Operator-scoped and platform-wide. */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Operator) private readonly operatorRepo: Repository<Operator>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Settlement) private readonly settlementRepo: Repository<Settlement>,
    private readonly scorecard: ScorecardService,
  ) {}

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  async operatorDashboard(operatorId: string) {
    const all = await this.bookingRepo.find({ where: { operatorId } });
    const confirmed = all.filter((b) => b.status === BookingStatus.CONFIRMED);
    const cancelled = all.filter((b) => b.status === BookingStatus.CANCELLED);
    const seatsSold = confirmed.reduce((s, b) => s + b.seats.length, 0);
    const revenue = this.round(confirmed.reduce((s, b) => s + Number(b.baseFare), 0));
    const conversionRate = all.length ? this.round(confirmed.length / all.length) : 0;
    return {
      operatorId,
      totalBookings: all.length,
      confirmed: confirmed.length,
      cancelled: cancelled.length,
      seatsSold,
      revenue,
      conversionRate,
    };
  }

  async platformDashboard() {
    const dayStart = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const [
      operatorsTotal, opActive, opPending, opSuspended, opRejected,
      customers, staff,
      totalBookings, cancelledBookings, bookingsToday,
      confirmed,
      pendingSettlements, openTickets,
    ] = await Promise.all([
      this.operatorRepo.count(),
      this.operatorRepo.count({ where: { status: OperatorStatus.ACTIVE } }),
      this.operatorRepo.count({ where: { status: OperatorStatus.PENDING_VERIFICATION } }),
      this.operatorRepo.count({ where: { status: OperatorStatus.SUSPENDED } }),
      this.operatorRepo.count({ where: { status: OperatorStatus.REJECTED } }),
      this.userRepo.count({ where: { role: Role.CUSTOMER } }),
      this.userRepo.count({ where: { role: Not(Role.CUSTOMER) } }),
      this.bookingRepo.count(),
      this.bookingRepo.count({ where: { status: BookingStatus.CANCELLED } }),
      this.bookingRepo.count({ where: { createdAt: Between(dayStart, dayEnd) } }),
      this.bookingRepo.find({ where: { status: BookingStatus.CONFIRMED }, select: ['baseFare', 'payableByPassenger', 'commissionBase', 'commissionGst', 'tcs', 'tds'] }),
      this.settlementRepo.find({ where: { status: Not('PAID') }, select: ['payout'] }),
      this.ticketRepo.count({ where: { status: In(['OPEN', 'ASSIGNED']) } }),
    ]);
    const gmv = this.round(confirmed.reduce((s, b) => s + Number(b.payableByPassenger), 0));
    const grossBaseFare = this.round(confirmed.reduce((s, b) => s + Number(b.baseFare), 0));
    const platformCommission = this.round(confirmed.reduce((s, b) => s + Number(b.commissionBase), 0));
    const taxCollected = this.round(confirmed.reduce((s, b) => s + Number(b.commissionGst) + Number(b.tcs) + Number(b.tds), 0));
    const pendingPayout = this.round(pendingSettlements.reduce((s, x) => s + Number(x.payout), 0));
    return {
      operators: { total: operatorsTotal, active: opActive, pending: opPending, suspended: opSuspended, rejected: opRejected },
      users: { customers, staff, total: customers + staff },
      bookings: { total: totalBookings, confirmed: confirmed.length, cancelled: cancelledBookings, today: bookingsToday },
      revenue: { gmv, grossBaseFare, platformCommission, taxCollected },
      settlements: { pendingPayout },
      support: { openTickets },
      topOperators: (await this.scorecard.leaderboard().catch(() => [])).slice(0, 5).map((o: any) => ({ operator: o.operatorName, code: o.operatorCode, score: o.score, grade: o.grade })),
    };
  }
}
