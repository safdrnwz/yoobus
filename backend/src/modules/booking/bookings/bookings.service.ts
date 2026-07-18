import { Injectable, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, LessThan } from 'typeorm';
import { customAlphabet } from 'nanoid';
import { randomUUID } from 'crypto';
import { Booking } from './entities/booking.entity';
import { SavedPassenger } from '../../customer/profile/entities/saved-passenger.entity';
import { BookingSeat } from './entities/booking-seat.entity';
import { SeatHold } from './entities/seat-hold.entity';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { CommissionLedger } from '../../finance/billing/entities/commission-ledger.entity';
import { Refund } from '../../finance/payments/entities/refund.entity';
import { Payment } from '../../finance/payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { Trip } from '../../operator/trips/entities/trip.entity';
import { User } from '../../customer/users/entities/user.entity';
import { TripsService } from '../../operator/trips/trips.service';
import { EmailService } from '../../integrations/email/email.service';
import { AppException } from '../../../common/errors/app-exception';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { Role } from '../../../common/enums/role.enum';
import { assertOperatorScope, assertResourceOwner } from '../../../common/logic/access.util';
import { TripStatus } from '../../../common/enums/trip-status.enum';
import { AC_BUS_TYPES } from '../../../common/enums/bus-type.enum';
import { segmentFare , seatFare } from '../../../common/logic/fare.util';
import { validateSeatGenderAssignment } from '../../../common/logic/seat-gender.util';
import { SeatAlertService } from '../seat-alert/seat-alert.service';
import { FareFreezeService } from '../../finance/fare-freeze/fare-freeze.service';
import { CouponsService } from '../../finance/coupons/coupons.service';
import { dynamicFareMultiplier, applyDynamicFare } from '../../../common/logic/dynamic-fare.util';
import { conflictingSeats } from '../../../common/logic/seat-overlap.util';
import { computeBookingTax, reverseCommission, TaxConfig } from '../../../common/logic/tax.util';
import { computeRefund } from '../../../common/logic/refund.util';
import { computeInsurance } from '../../../common/logic/insurance.util';
import { SEAT_HOLD_TTL_MINUTES as HOLD_TTL_MIN, PAYMENT_WINDOW_MINUTES as PAYMENT_WINDOW_MIN, RESCHEDULE_MIN_HOURS_BEFORE_DEPARTURE } from '../../../common/constants/app.constants';

const pnrGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);




/**
 * The seating THIS trip was sold on — never the live bus.
 *
 * A bus's layout can be republished at any time. Reading the bus directly would mean a
 * template change this morning silently alters a trip sold last week: a seat that was
 * ladies-reserved when a woman booked beside it might no longer be, and a seat number could
 * vanish from under a ticket. The trip's snapshot is the only honest source.
 *
 * Trips created before layouts existed carry no snapshot and fall back to the bus, which is
 * precisely what they did before — nothing old breaks.
 */
function seatingOf(trip: any, bus: any) {
  const snap = trip?.seatSnapshot;
  return {
    seatMap: (snap?.seatMap ?? bus.seatMap ?? []) as string[],
    totalSeats: (snap?.totalSeats ?? bus.totalSeats) as number,
    ladiesReservedSeats: (snap?.ladiesReservedSeats ?? bus.ladiesReservedSeats ?? []) as string[],
    seatAdjacency: (snap?.seatAdjacency ?? bus.seatAdjacency ?? {}) as Record<string, string>,
  };
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingSeat) private readonly seatRepo: Repository<BookingSeat>,
    @InjectRepository(SeatHold) private readonly holdRepo: Repository<SeatHold>,
    @InjectRepository(SavedPassenger) private readonly savedRepo: Repository<SavedPassenger>,
    @InjectRepository(Operator) private readonly opRepo: Repository<Operator>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Trip) private readonly tripDetailRepo: Repository<Trip>,
    private readonly trips: TripsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly seatAlert: SeatAlertService,
    private readonly fareFreeze: FareFreezeService,
    private readonly coupons: CouponsService,
    private readonly events: EventEmitter2,
  ) {}

  private taxCfg(): TaxConfig {
    return {
      fareGstRate: this.config.get<number>('tax.fareGstRate')!,
      commissionGstRate: this.config.get<number>('tax.commissionGstRate')!,
      tcsRate: this.config.get<number>('tax.tcsRate')!,
      tdsRate: this.config.get<number>('tax.tdsRate')!,
    };
  }

  // Release expired holds and free PENDING bookings that have timed out on payment.
  private async releaseExpired(tripId?: string) {
    const qb = this.holdRepo.createQueryBuilder().update(SeatHold).set({ active: false })
      .where('active = true').andWhere('expiresAt <= NOW()');
    if (tripId) qb.andWhere('tripId = :t', { t: tripId });
    await qb.execute();

    const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MIN * 60 * 1000);
    const stale = await this.bookingRepo.find({ where: { status: BookingStatus.PENDING, createdAt: LessThan(cutoff) } });
    for (const b of stale) {
      await this.dataSource.transaction(async (m) => {
        await m.getRepository(BookingSeat).update({ bookingId: b.id }, { isActive: false });
        b.status = BookingStatus.CANCELLED; b.cancelReason = 'PAYMENT_TIMEOUT';
        await m.getRepository(Booking).save(b);
      });
    }
  }

  private resolveSegment(route: any, boardingStopId: string, droppingStopId: string, multiplier: number) {
    const fares = route.routeStops.map((rs: any) => ({ stopId: rs.stopId, stopOrder: rs.stopOrder, fareFromOrigin: Number(rs.fareFromOrigin) }));
    const perSeat = segmentFare(fares, boardingStopId, droppingStopId, multiplier);
    if (perSeat <= 0) throw new AppException('INVALID_SEGMENT', 'Invalid segment or fare', HttpStatus.BAD_REQUEST);
    const board = route.routeStops.find((r: any) => r.stopId === boardingStopId)!.stopOrder;
    const drop = route.routeStops.find((r: any) => r.stopId === droppingStopId)!.stopOrder;
    return { perSeat, board, drop };
  }

  /** Applies demand-based dynamic pricing to a base per-seat fare (no-op unless enabled). */
  private dynamicPerSeat(trip: any, basePerSeat: number, occupancyPct: number): number {
    if (!this.config.get<boolean>('pricing.dynamicEnabled')) return basePerSeat;
    const base = Number(trip.fareMultiplier);
    const hour = parseInt((trip.departureTime || '00:00').slice(0, 2), 10);
    const dep = new Date(trip.departureDate + 'T00:00:00').getTime();
    const days = Math.max(0, Math.ceil((dep - Date.now()) / 86400000));
    const mult = dynamicFareMultiplier({ occupancyPct, daysToDeparture: days, baseMultiplier: base, hour });
    return applyDynamicFare(basePerSeat, base, mult);
  }

  // ---- PHASE 1: SEAT HOLD (TTL) ----
  async hold(dto: { tripId: string; boardingStopId: string; droppingStopId: string; seatNumbers: string[]; freezeToken?: string }) {
    const { trip, route, bus } = await this.trips.findFull(dto.tripId);
    if (trip.status !== TripStatus.SCHEDULED) throw new AppException('TRIP_CLOSED', 'Booking is closed for this trip', HttpStatus.BAD_REQUEST);
    await this.releaseExpired(trip.id);
    const { perSeat, board, drop } = this.resolveSegment(route, dto.boardingStopId, dto.droppingStopId, Number(trip.fareMultiplier));

    if (new Set(dto.seatNumbers).size !== dto.seatNumbers.length) throw new AppException('DUP_SEAT', 'Duplicate seat selected', HttpStatus.BAD_REQUEST);
    const seating = seatingOf(trip, bus);
    const invalid = dto.seatNumbers.filter((s) => !seating.seatMap.includes(s));
    if (invalid.length) throw new AppException('INVALID_SEAT', `Invalid seat(s): ${invalid.join(', ')}`, HttpStatus.BAD_REQUEST);

    return this.dataSource.transaction(async (m) => {
      const seatRepo = m.getRepository(BookingSeat);
      const holdRepo = m.getRepository(SeatHold);
      const activeSeats = await seatRepo.find({ where: { tripId: trip.id, isActive: true } });
      const activeHolds = await holdRepo.createQueryBuilder('h').setLock('pessimistic_write')
        .where('h.tripId = :t', { t: trip.id }).andWhere('h.active = true').andWhere('h.expiresAt > NOW()').getMany();
      const segs = [
        ...activeSeats.map((s) => ({ seatNumber: s.seatNumber, boardingOrder: s.boardingStopOrder, droppingOrder: s.droppingStopOrder })),
        ...activeHolds.map((h) => ({ seatNumber: h.seatNumber, boardingOrder: h.boardingStopOrder, droppingOrder: h.droppingStopOrder })),
      ];
      const conflict = conflictingSeats(segs, dto.seatNumbers, board, drop);
      if (conflict.length) throw new AppException('SEAT_UNAVAILABLE', `Seat(s) ${[...new Set(conflict)].join(', ')} are no longer available for the selected segment.`, HttpStatus.CONFLICT);

      // Lock the (possibly dynamic) price at seat-selection time.
      const occupancyPct = seating.totalSeats > 0 ? activeSeats.length / seating.totalSeats : 0;
      let lockedPerSeat = this.dynamicPerSeat(trip, perSeat, occupancyPct);
      // A valid fare-freeze token overrides the live price with the frozen one.
      if (dto.freezeToken) {
        const frozen = await this.fareFreeze.resolve(dto.freezeToken, trip.id, dto.boardingStopId, dto.droppingStopId);
        if (frozen) { lockedPerSeat = Number(frozen.lockedFarePerSeat); await this.fareFreeze.markUsed(dto.freezeToken); }
      }

      // Per-seat pricing. A hold already stores one row PER SEAT, so each row can carry its
      // own locked price — no schema change needed, and the price the passenger was shown is
      // the price they pay, seat by seat.
      //
      // `lockedPerSeat` is the dynamic base (route segment × trip multiplier × occupancy
      // surge). The seat's own rule sits on top of that: a lower berth is dearer than the
      // back row on the same trip, on the same segment, at the same moment.
      const fareOf = (sn: string) => seatFare(lockedPerSeat, 1, (bus.seatFares ?? {})[sn.toUpperCase()]);
      const perSeatFares: Record<string, number> = {};
      for (const sn of dto.seatNumbers) perSeatFares[sn] = fareOf(sn);
      const amountEstimate = Math.round(Object.values(perSeatFares).reduce((a, b) => a + b, 0) * 100) / 100;

      const holdToken = randomUUID();
      const expiresAt = new Date(Date.now() + HOLD_TTL_MIN * 60 * 1000);
      await holdRepo.save(dto.seatNumbers.map((sn) => holdRepo.create({
        holdToken, tripId: trip.id, seatNumber: sn, boardingStopOrder: board, droppingStopOrder: drop,
        boardingStopId: dto.boardingStopId, droppingStopId: dto.droppingStopId, expiresAt, active: true,
        lockedFarePerSeat: perSeatFares[sn],
      })));
      return {
        holdToken,
        expiresAt,
        seats: dto.seatNumbers,
        /** What each seat actually costs. They are no longer all the same. */
        farePerSeat: perSeatFares,
        amountEstimate,
      };
    });
  }

  // ---- Booking from hold => PENDING ----
  async createFromHold(userId: string, dto: { holdToken: string; passengers: any[]; optInsurance?: boolean; couponCode?: string; source?: string; channelCode?: string; otaRef?: string }) {
    // Requirement 4 — profile-completion gate: a passenger cannot book until
    // their profile has Full Name + Date of Birth + Gender. (Skip for OTA/agent flows
    // where the booking is made on behalf of a walk-in guest via source override.)
    const isSelfServe = !dto.source || dto.source === 'DIRECT';
    if (isSelfServe) {
      const account = await this.userRepo.findOne({ where: { id: userId } });
      if (account && account.role === 'CUSTOMER') {
        const missing: string[] = [];
        if (!account.fullName || account.fullName.trim().length < 2) missing.push('Full Name');
        if (!account.dateOfBirth) missing.push('Date of Birth');
        if (!account.gender) missing.push('Gender');
        if (missing.length) {
          throw new AppException('PROFILE_INCOMPLETE', `Please complete your profile before booking. Missing: ${missing.join(', ')}.`, HttpStatus.BAD_REQUEST);
        }
      }
    }

    const holds = await this.holdRepo.find({ where: { holdToken: dto.holdToken, active: true } });
    if (!holds.length) throw new AppException('HOLD_INVALID', 'Hold expired or invalid — please select seats again', HttpStatus.BAD_REQUEST);
    if (holds.some((h) => h.expiresAt.getTime() <= Date.now())) throw new AppException('HOLD_EXPIRED', 'Seat hold has expired', HttpStatus.BAD_REQUEST);

    const tripId = holds[0].tripId;
    const heldSeats = holds.map((h) => h.seatNumber).sort();
    const passSeats = dto.passengers.map((p) => p.seatNumber).sort();
    if (heldSeats.length !== passSeats.length || heldSeats.some((s, i) => s !== passSeats[i]))
      throw new AppException('SEAT_MISMATCH', 'Passenger seats do not match the hold', HttpStatus.BAD_REQUEST);

    const { trip, route, bus } = await this.trips.findFull(tripId);
    const boardingStopId = holds[0].boardingStopId, droppingStopId = holds[0].droppingStopId;
    const { perSeat, board, drop } = this.resolveSegment(route, boardingStopId, droppingStopId, Number(trip.fareMultiplier));
    const operator = await this.opRepo.findOne({ where: { id: trip.operatorId } });
    if (!operator) throw new AppException('OPERATOR_NOT_FOUND', 'Operator not found', HttpStatus.NOT_FOUND);

    // Honour the price locked at hold time, SEAT BY SEAT.
    //
    // This used to take holds[0]'s fare and multiply it by the passenger count — which was
    // only ever correct because every seat cost the same. With per-seat pricing that would
    // charge four lower berths at the price of whichever one happened to be first in the
    // array. Sum what each seat actually locked.
    const lockedBySeat = new Map<string, number>();
    for (const h of holds) {
      lockedBySeat.set(h.seatNumber, h.lockedFarePerSeat != null ? Number(h.lockedFarePerSeat) : perSeat);
    }
    const fareForSeat = (sn: string) => lockedBySeat.get(sn) ?? perSeat;
    // Resolve any saved-passenger references into concrete traveller details.
    for (const p of dto.passengers) {
      if (p.savedPassengerId) {
        const sp = await this.savedRepo.findOne({ where: { id: p.savedPassengerId } });
        if (!sp || sp.userId !== userId) throw new AppException('SAVED_PASSENGER_INVALID', 'Saved passenger not found', HttpStatus.BAD_REQUEST);
        p.name = p.name ?? sp.fullName; p.age = p.age ?? sp.age ?? 18; p.gender = p.gender ?? sp.gender ?? 'OTHER';
      }
      if (!p.name || p.age == null || !p.gender) throw new AppException('PASSENGER_INCOMPLETE', 'Passenger name, age and gender are required.', HttpStatus.BAD_REQUEST);
    }

    // Requirements 7-10 — gender-based seat validation (ladies-reserved + adjacency).
    // Fetch seats already occupied on this trip (active bookings) with their genders.
    const occupiedRows: Array<{ seatNumber: string; passengerGender: string }> = await this.dataSource.query(
      `SELECT "seatNumber", "passengerGender" FROM booking_seats WHERE trip_id = $1 AND is_active = true`,
      [tripId],
    );
    const seatCheck = validateSeatGenderAssignment(
      dto.passengers.map((p) => ({ seatNumber: p.seatNumber, gender: p.gender })),
      seatingOf(trip, bus).ladiesReservedSeats,
      seatingOf(trip, bus).seatAdjacency,
      occupiedRows.map((r) => ({ seatNumber: r.seatNumber, gender: r.passengerGender })),
    );
    if (!seatCheck.ok) {
      throw new AppException(seatCheck.code!, seatCheck.message!, HttpStatus.BAD_REQUEST);
    }
    const grossFare =
      Math.round(dto.passengers.reduce((sum: number, p: any) => sum + fareForSeat(p.seatNumber), 0) * 100) / 100;
    // Apply a coupon (if any) to the fare before tax; discount reduces fare, GST and commission proportionally.
    let couponDiscount = 0; let couponId: string | null = null;
    if (dto.couponCode) {
      const q = await this.coupons.quote(dto.couponCode, grossFare, userId, trip.operatorId);
      couponDiscount = q.discount; couponId = q.couponId;
    }
    const baseFare = Math.max(0, Math.round((grossFare - couponDiscount) * 100) / 100);
    const isAc = AC_BUS_TYPES.includes(bus.busType);
    const tax = computeBookingTax(baseFare, Number(operator.commissionRate), this.taxCfg(), isAc);
    const ins = dto.optInsurance
      ? computeInsurance(dto.passengers.length, {
          premiumPerPassenger: this.config.get<number>('insurance.premiumPerPassenger')!,
          gstRate: this.config.get<number>('insurance.gstRate')!,
        })
      : { premium: 0, gst: 0, total: 0 };

    return this.dataSource.transaction(async (m) => {
      const bookingRepo = m.getRepository(Booking);
      const booking = await bookingRepo.save(bookingRepo.create({
        pnr: pnrGen(), userId, operatorId: trip.operatorId, tripId,
        source: dto.source ?? 'DIRECT', channelCode: dto.channelCode ?? null, otaRef: dto.otaRef ?? null,
        boardingStopOrder: board, droppingStopOrder: drop, boardingStopId, droppingStopId,
        baseFare: tax.baseFare, fareGst: tax.fareGst,
        commissionRateSnapshot: Number(operator.commissionRate),
        commissionBase: tax.commissionBase, commissionGst: tax.commissionGst, tcs: tax.tcs, tds: tax.tds, operatorNet: tax.operatorNet,
        insurancePremium: ins.premium, insuranceGst: ins.gst,
        payableByPassenger: Math.round((tax.payableByPassenger + ins.total) * 100) / 100,
        status: BookingStatus.PENDING,
        seats: dto.passengers.map((p) => Object.assign(new BookingSeat(), {
          tripId, seatNumber: p.seatNumber, boardingStopOrder: board, droppingStopOrder: drop,
          passengerName: p.name, passengerAge: p.age, passengerGender: p.gender,
          // What THIS seat was locked at, not the trip's base fare. Storing `perSeat` here
          // meant a refund or a ticket reprint would quote the wrong number for a premium
          // berth — the money would balance in aggregate and be wrong on every line.
          fare: fareForSeat(p.seatNumber),
          isActive: true,
        })),
      }));
      // holds consume
      await m.getRepository(SeatHold).update({ holdToken: dto.holdToken }, { active: false });
      if (couponId) await this.coupons.redeem(couponId, userId, booking.id, couponDiscount);
      return { bookingId: booking.id, pnr: booking.pnr, status: booking.status, payable: booking.payableByPassenger, couponDiscount };
    });
  }

  // ---- PHASE 1: payment confirm (PaymentsService se call) ----
  async confirmPayment(bookingId: string) {
    const booking = await this.findById(bookingId);
    if (booking.status === BookingStatus.CONFIRMED) return booking;
    if (booking.status !== BookingStatus.PENDING) throw new AppException('BOOKING_NOT_PENDING', 'Booking is not pending', HttpStatus.BAD_REQUEST);

    return this.dataSource.transaction(async (m) => {
      booking.status = BookingStatus.CONFIRMED;
      const saved = await m.getRepository(Booking).save(booking);
      await m.getRepository(CommissionLedger).save(m.getRepository(CommissionLedger).create({
        operatorId: booking.operatorId, bookingId: booking.id, entryType: 'CREDIT',
        commissionBase: booking.commissionBase, commissionGst: booking.commissionGst, tcs: booking.tcs, tds: booking.tds,
      }));
      const passenger = await this.userRepo.findOne({ where: { id: booking.userId } });
      const operator = await this.opRepo.findOne({ where: { id: booking.operatorId } });
      const { route } = await this.trips.findFull(booking.tripId);
      const fromName = route.routeStops.find((r: any) => r.stopId === booking.boardingStopId)?.stop?.name;
      const toName = route.routeStops.find((r: any) => r.stopId === booking.droppingStopId)?.stop?.name;
      const trip = (await this.trips.findFull(booking.tripId)).trip;
      await this.email.send({
        to: passenger?.email || 'unknown@unknown.com', template: 'BOOKING_CONFIRMED',
        vars: { name: passenger?.fullName, pnr: booking.pnr, operatorName: operator?.brandName || operator?.legalName,
          from: fromName, to: toName, date: trip.departureDate, time: trip.departureTime,
          seats: booking.seats.map((s) => s.seatNumber).join(', '), baseFare: booking.baseFare, fareGst: booking.fareGst, payable: booking.payableByPassenger },
        operatorId: booking.operatorId, recipientOperatorId: null,
      });
      // Decoupled fan-out: loyalty points, etc. (no circular imports).
      this.events.emit('booking.confirmed', { userId: booking.userId, amount: Number(booking.payableByPassenger), bookingId: booking.id, operatorId: booking.operatorId });
      return saved;
    });
  }

  findByUser(userId: string) { return this.bookingRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }); }
  listByOperator(operatorId: string, includeDeleted = false) { return this.bookingRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' }, withDeleted: includeDeleted }); }
  /** Unified "manage my trip" view: booking + seats + payment + refund + review + trip + actions. */
  async bookingDetail(bookingId: string) {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId }, relations: ['seats'] });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'Booking not found', HttpStatus.NOT_FOUND);
    const [payment, refund, review, trip] = await Promise.all([
      this.paymentRepo.findOne({ where: { bookingId }, order: { createdAt: 'DESC' } }).catch(() => null),
      this.refundRepo.findOne({ where: { bookingId }, order: { createdAt: 'DESC' } }).catch(() => null),
      this.reviewRepo.findOne({ where: { userId: booking.userId, tripId: booking.tripId } }).catch(() => null),
      this.tripDetailRepo.findOne({ where: { id: booking.tripId } }).catch(() => null),
    ]);
    const hoursLeft = await this.hoursBeforeDeparture(booking).catch(() => -1);
    const isConfirmed = booking.status === BookingStatus.CONFIRMED;
    const departed = (trip && (trip.status === 'RUNNING' || trip.status === 'COMPLETED')) || hoursLeft <= 0;
    return {
      booking: {
        id: booking.id, pnr: booking.pnr, status: booking.status, operatorId: booking.operatorId,
        payableByPassenger: Number(booking.payableByPassenger), bookedOn: booking.createdAt,
        passengers: (booking as any).seats?.map((st: any) => ({ seatNumber: st.seatNumber, name: st.passengerName, age: st.passengerAge, gender: st.passengerGender })) ?? [],
      },
      payment: payment ? { status: payment.status, gateway: (payment as any).gateway, amount: Number(payment.amount) } : null,
      refund: refund ? { status: refund.status, amount: Number(refund.refundAmount), mode: (refund as any).mode } : null,
      trip: trip ? { status: trip.status, departureDate: (trip as any).departureDate, departureTime: (trip as any).departureTime } : null,
      review: review ? { rated: true, rating: review.rating } : { rated: false },
      actions: {
        canCancel: isConfirmed && !departed,
        canReschedule: isConfirmed && !departed,
        canReview: isConfirmed && departed && !review,
        canTrack: trip?.status === 'RUNNING',
      },
    };
  }

  /** Cancel specific seats from a confirmed booking; the rest keep travelling. Proportional refund. */
  async partialCancel(bookingId: string, actor: { id: string; role: Role; operatorId: string | null }, seatNumbers: string[], reason?: string, refundToWallet = false) {
    const booking = await this.findById(bookingId);
    const isStaff = [Role.OPERATOR_ADMIN, Role.SUPPORT].includes(actor.role);
    if (isStaff) {
      const scope = assertOperatorScope(actor.role, actor.operatorId, booking.operatorId);
      if (!scope.ok) throw new AppException(scope.code!, scope.message!, HttpStatus.FORBIDDEN);
    } else if (actor.role === Role.CUSTOMER) {
      const owner = assertResourceOwner(actor.role, actor.id, booking.userId);
      if (!owner.ok) throw new AppException(owner.code!, owner.message!, HttpStatus.FORBIDDEN);
    } else if (actor.role !== Role.SUPERADMIN) {
      throw new AppException('FORBIDDEN', 'Cancellation is not allowed', HttpStatus.FORBIDDEN);
    }
    if (booking.status !== BookingStatus.CONFIRMED) throw new AppException('NOT_CONFIRMED', 'Only confirmed bookings can be partially cancelled', HttpStatus.BAD_REQUEST);

    const seatRepo = this.dataSource.getRepository(BookingSeat);
    const activeSeats = await seatRepo.find({ where: { bookingId: booking.id, isActive: true } });
    const toCancel = activeSeats.filter((st) => seatNumbers.includes(st.seatNumber));
    if (toCancel.length === 0) throw new AppException('SEAT_NOT_FOUND', 'None of those seats are active on this booking', HttpStatus.BAD_REQUEST);
    if (toCancel.length >= activeSeats.length) return this.cancel(bookingId, actor, reason, refundToWallet); // cancelling all -> full cancel

    const hours = await this.hoursBeforeDeparture(booking);
    const cancelledFare = toCancel.reduce((sum, st) => sum + Number(st.fare), 0);
    const refundCalc = computeRefund(cancelledFare, hours);
    const frac = toCancel.length / activeSeats.length;
    const r2 = (v: number) => Math.round(v * 100) / 100;

    await this.dataSource.transaction(async (m) => {
      const cancelSet = new Set(toCancel.map((st) => st.seatNumber));
      for (const st of toCancel) { st.isActive = false; await m.getRepository(BookingSeat).save(st); }
      // Keep the eager-loaded seats in sync; the cascade on save would otherwise re-activate them.
      booking.seats?.forEach((st) => { if (cancelSet.has(st.seatNumber)) st.isActive = false; });
      // Proportional commission reversal for the cancelled seats.
      const rev = reverseCommission({ commissionBase: r2(Number(booking.commissionBase) * frac), commissionGst: r2(Number(booking.commissionGst) * frac), tcs: r2(Number(booking.tcs) * frac), tds: r2(Number(booking.tds) * frac) } as any);
      await m.getRepository(CommissionLedger).save(m.getRepository(CommissionLedger).create({
        operatorId: booking.operatorId, bookingId: booking.id, entryType: 'DEBIT',
        commissionBase: rev.commissionReversed, commissionGst: rev.commissionGstReversed, tcs: rev.tcsReversed, tds: rev.tdsReversed,
      }));
      // Reduce booking financials proportionally; booking stays CONFIRMED for remaining travellers.
      booking.baseFare = r2(Number(booking.baseFare) * (1 - frac));
      booking.fareGst = r2(Number(booking.fareGst) * (1 - frac));
      booking.payableByPassenger = r2(Number(booking.payableByPassenger) * (1 - frac));
      booking.commissionBase = r2(Number(booking.commissionBase) * (1 - frac));
      booking.commissionGst = r2(Number(booking.commissionGst) * (1 - frac));
      booking.tcs = r2(Number(booking.tcs) * (1 - frac));
      booking.tds = r2(Number(booking.tds) * (1 - frac));
      booking.operatorNet = r2(Number(booking.operatorNet) * (1 - frac));
      await m.getRepository(Booking).save(booking);
      if (refundCalc.refundAmount > 0) {
        await m.getRepository(Refund).save(m.getRepository(Refund).create({
          bookingId: booking.id, userId: booking.userId, amountPaid: cancelledFare,
          refundPct: refundCalc.refundPct, refundAmount: refundCalc.refundAmount, cancellationCharge: refundCalc.cancellationCharge,
          mode: refundToWallet ? 'WALLET' : 'SOURCE', status: refundToWallet ? 'PROCESSED' : 'INITIATED',
        }));
      }
    });

    const passenger = await this.userRepo.findOne({ where: { id: booking.userId } });
    const operator = await this.opRepo.findOne({ where: { id: booking.operatorId } });
    await this.email.send({
      to: passenger?.email || 'unknown@unknown.com', template: 'BOOKING_CANCELLED',
      vars: { name: passenger?.fullName, pnr: booking.pnr, operatorName: operator?.brandName || operator?.legalName, refund: refundCalc.refundAmount },
      operatorId: booking.operatorId, recipientOperatorId: null,
    });
    await this.seatAlert.notifyWatchers(booking.tripId);
    if (refundToWallet && refundCalc.refundAmount > 0) {
      this.events.emit('booking.refund.wallet', { userId: booking.userId, amount: refundCalc.refundAmount, bookingId: booking.id });
    }
    return { pnr: booking.pnr, cancelledSeats: toCancel.map((s) => s.seatNumber), remainingSeats: activeSeats.length - toCancel.length, refund: refundCalc };
  }

  async findByPnr(pnr: string) {
    const b = await this.bookingRepo.findOne({ where: { pnr } });
    if (!b) throw new AppException('PNR_NOT_FOUND', 'PNR not found', HttpStatus.NOT_FOUND);
    return this.bookingDetail(b.id);
  }

  /** Raw booking row (with userId) for internal callers like the OTA channel — not the trimmed public detail shape. */
  async findByPnrRaw(pnr: string) {
    return this.bookingRepo.findOne({ where: { pnr } });
  }
  async findById(id: string) {
    const b = await this.bookingRepo.findOne({ where: { id } });
    if (!b) throw new AppException('BOOKING_NOT_FOUND', 'Booking not found', HttpStatus.NOT_FOUND);
    return b;
  }

  private async hoursBeforeDeparture(booking: Booking): Promise<number> {
    const { trip } = await this.trips.findFull(booking.tripId);
    const dep = new Date(`${trip.departureDate}T${trip.departureTime}:00`);
    return (dep.getTime() - Date.now()) / (1000 * 60 * 60);
  }

  // ---- PHASE 2: cancel + refund-to-wallet + commission reversal ----
  async cancel(bookingId: string, actor: { id: string; role: Role; operatorId: string | null }, reason?: string, refundToWallet = false) {
    const booking = await this.findById(bookingId);
    const isStaff = [Role.OPERATOR_ADMIN, Role.SUPPORT].includes(actor.role);
    if (isStaff) {
      const scope = assertOperatorScope(actor.role, actor.operatorId, booking.operatorId);
      if (!scope.ok) throw new AppException(scope.code!, scope.message!, HttpStatus.FORBIDDEN);
    } else if (actor.role === Role.CUSTOMER) {
      const owner = assertResourceOwner(actor.role, actor.id, booking.userId);
      if (!owner.ok) throw new AppException(owner.code!, owner.message!, HttpStatus.FORBIDDEN);
    } else if (actor.role !== Role.SUPERADMIN) {
      throw new AppException('FORBIDDEN', 'Cancellation is not allowed', HttpStatus.FORBIDDEN);
    }
    if (booking.status === BookingStatus.CANCELLED) throw new AppException('ALREADY_CANCELLED', 'Booking is already cancelled', HttpStatus.BAD_REQUEST);

    const hours = await this.hoursBeforeDeparture(booking);
    const wasConfirmed = booking.status === BookingStatus.CONFIRMED;
    const refundCalc = computeRefund(Number(booking.payableByPassenger), hours);

    const result = await this.dataSource.transaction(async (m) => {
      await m.getRepository(BookingSeat).update({ bookingId: booking.id }, { isActive: false });
      if (wasConfirmed) {
        const rev = reverseCommission({ commissionBase: Number(booking.commissionBase), commissionGst: Number(booking.commissionGst), tcs: Number(booking.tcs), tds: Number(booking.tds) } as any);
        await m.getRepository(CommissionLedger).save(m.getRepository(CommissionLedger).create({
          operatorId: booking.operatorId, bookingId: booking.id, entryType: 'DEBIT',
          commissionBase: rev.commissionReversed, commissionGst: rev.commissionGstReversed, tcs: rev.tcsReversed, tds: rev.tdsReversed,
        }));
      }
      booking.status = BookingStatus.CANCELLED; booking.cancelReason = reason || 'Cancelled';
      // Keep the eager-loaded seats in sync; the cascade on save would otherwise re-activate them.
      booking.seats?.forEach((st) => (st.isActive = false));
      const saved = await m.getRepository(Booking).save(booking);
      if (wasConfirmed && refundCalc.refundAmount > 0) {
        await m.getRepository(Refund).save(m.getRepository(Refund).create({
          bookingId: booking.id, userId: booking.userId, amountPaid: Number(booking.payableByPassenger),
          refundPct: refundCalc.refundPct, refundAmount: refundCalc.refundAmount, cancellationCharge: refundCalc.cancellationCharge, mode: refundToWallet ? 'WALLET' : 'SOURCE', status: refundToWallet ? 'PROCESSED' : 'INITIATED',
        }));
      }
      return saved;
    });

    // Refund is issued back to the original payment source (no wallet). The Refund row is
    // recorded as INITIATED; the payment gateway processes the actual credit asynchronously.

    const passenger = await this.userRepo.findOne({ where: { id: booking.userId } });
    const operator = await this.opRepo.findOne({ where: { id: booking.operatorId } });
    await this.email.send({
      to: passenger?.email || 'unknown@unknown.com', template: 'BOOKING_CANCELLED',
      vars: { name: passenger?.fullName, pnr: booking.pnr, operatorName: operator?.brandName || operator?.legalName, refund: refundCalc.refundAmount },
      operatorId: booking.operatorId, recipientOperatorId: null,
    });

    // A seat just freed up — alert anyone who was watching this full trip (email + SMS + WhatsApp).
    await this.seatAlert.notifyWatchers(booking.tripId);
    // If the customer chose wallet refund, credit it via an event (no circular import).
    if (refundToWallet && wasConfirmed && refundCalc.refundAmount > 0) {
      this.events.emit('booking.refund.wallet', { userId: booking.userId, amount: refundCalc.refundAmount, bookingId: booking.id });
    }
    return { booking: result, refund: refundCalc };
  }

  // ---- PHASE 2: reschedule (same route, diff trip, same seats) ----
  async reschedule(bookingId: string, actor: { id: string; role: Role }, newTripId: string) {
    const booking = await this.findById(bookingId);
    const rOwner = assertResourceOwner(actor.role, actor.id, booking.userId);
    if (!rOwner.ok) throw new AppException(rOwner.code!, rOwner.message!, HttpStatus.FORBIDDEN);
    if (![BookingStatus.CONFIRMED, BookingStatus.PENDING].includes(booking.status)) throw new AppException('CANNOT_RESCHEDULE', 'This booking cannot be rescheduled', HttpStatus.BAD_REQUEST);
    const hours = await this.hoursBeforeDeparture(booking);
    if (hours < RESCHEDULE_MIN_HOURS_BEFORE_DEPARTURE) throw new AppException('RESCHEDULE_WINDOW', 'Reschedule is allowed only up to 4 hours before departure', HttpStatus.BAD_REQUEST);

    const oldFull = await this.trips.findFull(booking.tripId);
    const newFull = await this.trips.findFull(newTripId);
    if (newFull.trip.routeId !== oldFull.trip.routeId) throw new AppException('RESCHEDULE_SAME_ROUTE', 'Reschedule is only allowed to another trip on the same route', HttpStatus.BAD_REQUEST);
    if (newFull.trip.status !== TripStatus.SCHEDULED) throw new AppException('TRIP_CLOSED', 'The new trip is not available', HttpStatus.BAD_REQUEST);

    const seatNumbers = booking.seats.map((s) => s.seatNumber);
    const { perSeat, board, drop } = this.resolveSegment(newFull.route, booking.boardingStopId, booking.droppingStopId, Number(newFull.trip.fareMultiplier));

    return this.dataSource.transaction(async (m) => {
      // Check seat availability on the new trip.
      const activeSeats = await m.getRepository(BookingSeat).find({ where: { tripId: newTripId, isActive: true } });
      const activeHolds = await m.getRepository(SeatHold).createQueryBuilder('h')
        .where('h.tripId = :t', { t: newTripId }).andWhere('h.active = true').andWhere('h.expiresAt > NOW()').getMany();
      const segs = [
        ...activeSeats.map((s) => ({ seatNumber: s.seatNumber, boardingOrder: s.boardingStopOrder, droppingOrder: s.droppingStopOrder })),
        ...activeHolds.map((h) => ({ seatNumber: h.seatNumber, boardingOrder: h.boardingStopOrder, droppingOrder: h.droppingStopOrder })),
      ];
      const conflict = conflictingSeats(segs, seatNumbers, board, drop);
      if (conflict.length) throw new AppException('SEAT_UNAVAILABLE', `Seat(s) ${[...new Set(conflict)].join(', ')} are not available on the new trip.`, HttpStatus.CONFLICT);

      // Release the old seats and create the new ones.
      await m.getRepository(BookingSeat).update({ bookingId: booking.id }, { isActive: false });
      const newBaseFare = perSeat * seatNumbers.length;
      const operator = await this.opRepo.findOne({ where: { id: booking.operatorId } });
      const isAc = AC_BUS_TYPES.includes(newFull.bus.busType);
      const tax = computeBookingTax(newBaseFare, Number(operator!.commissionRate), this.taxCfg(), isAc);
      const diff = Math.round((tax.payableByPassenger - Number(booking.payableByPassenger)) * 100) / 100;

      // Fare difference: a positive diff must be collected from the passenger (payment),
      // a negative diff is refunded to the original source. No wallet is used.
      if (diff < 0) {
        await m.getRepository(Refund).save(m.getRepository(Refund).create({
          bookingId: booking.id, userId: booking.userId, amountPaid: Number(booking.payableByPassenger),
          refundPct: 1, refundAmount: -diff, cancellationCharge: 0, mode: 'SOURCE', status: 'INITIATED',
        }));
      }

      booking.tripId = newTripId;
      booking.boardingStopOrder = board; booking.droppingStopOrder = drop;
      booking.baseFare = tax.baseFare; booking.fareGst = tax.fareGst; booking.payableByPassenger = tax.payableByPassenger;
      booking.commissionBase = tax.commissionBase; booking.commissionGst = tax.commissionGst; booking.tcs = tax.tcs; booking.tds = tax.tds; booking.operatorNet = tax.operatorNet;
      const oldSeats = booking.seats;
      // Insert the new seats via raw SQL: TypeORM's cascade/save path for this entity does not
      // reliably populate booking_id here (the column is dual-mapped by both a @Column and the
      // @ManyToOne @JoinColumn), so we bypass entity-level persistence for this one insert.
      const insertedSeats: BookingSeat[] = [];
      for (let i = 0; i < seatNumbers.length; i++) {
        const sn = seatNumbers[i];
        const passengerName = oldSeats[i]?.passengerName || 'Passenger';
        const passengerAge = oldSeats[i]?.passengerAge || 18;
        const passengerGender = oldSeats[i]?.passengerGender || 'OTHER';
        const rows = await m.query(
          `INSERT INTO booking_seats (id, booking_id, trip_id, "seatNumber", "boardingStopOrder", "droppingStopOrder", "passengerName", "passengerAge", "passengerGender", fare, is_active)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING *`,
          [booking.id, newTripId, sn, board, drop, passengerName, passengerAge, passengerGender, perSeat],
        );
        insertedSeats.push(Object.assign(new BookingSeat(), rows[0]));
      }
      // Detach seats before saving the parent — cascade would otherwise re-process (and can
      // corrupt) the rows we just inserted directly, since this FK column is dual-mapped.
      booking.seats = undefined as any;
      const saved = await m.getRepository(Booking).save(booking);
      saved.seats = insertedSeats;
      const passenger = await this.userRepo.findOne({ where: { id: booking.userId } });
      const opEmail = await this.opRepo.findOne({ where: { id: booking.operatorId } });
      await this.email.send({
        to: passenger?.email || 'unknown@unknown.com',
        template: 'BOOKING_RESCHEDULED',
        vars: {
          name: passenger?.fullName,
          pnr: booking.pnr,
          operatorName: opEmail?.brandName || opEmail?.legalName,
          date: newFull.trip.departureDate,
          time: newFull.trip.departureTime,
          fareDifference: diff,
        },
        operatorId: booking.operatorId,
        recipientOperatorId: null,
      });
      return { booking: saved, fareDifference: diff };
    });
  }
}
