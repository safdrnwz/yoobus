import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip } from './entities/trip.entity';
import { Bus } from '../buses/entities/bus.entity';
import { Route } from '../routes/entities/route.entity';
import { BookingSeat } from '../../booking/bookings/entities/booking-seat.entity';
import { SeatHold } from '../../booking/bookings/entities/seat-hold.entity';
import { AppException } from '../../../common/errors/app-exception';
import { TripStatus } from '../../../common/enums/trip-status.enum';
import { checkBusRouteForTrip } from '../../../common/logic/invariants.util';
import { segmentFare, RouteStopFare , seatFare } from '../../../common/logic/fare.util';
import { occupiedSeats } from '../../../common/logic/seat-overlap.util';
import { dynamicFareMultiplier, applyDynamicFare } from '../../../common/logic/dynamic-fare.util';
import { ConfigService } from '@nestjs/config';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Refund } from '../../finance/payments/entities/refund.entity';
import { User } from '../../customer/users/entities/user.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { EmailService } from '../../integrations/email/email.service';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(BookingSeat) private readonly seatRepo: Repository<BookingSeat>,
    @InjectRepository(SeatHold) private readonly holdRepo: Repository<SeatHold>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // active booking_seats + active (non-expired) holds dono se occupied seats
  /**
   * Who is sitting where.
   *
   * A woman travelling alone has to be able to see, BEFORE she taps, which seats she may take
   * and who is already sitting beside them. That is not a nicety — it is the single most
   * common reason a female passenger abandons a booking, and every Indian bus operator's seat
   * map shows it.
   *
   * We publish the OCCUPANT'S GENDER on a booked seat, and nothing else: no name, no age, no
   * booking id. A seat's gender is exactly as much as the person choosing the seat beside it
   * needs, and no more.
   */
  private async occupantGenders(tripId: string): Promise<Record<string, 'MALE' | 'FEMALE'>> {
    const seats = await this.seatRepo.find({
      where: { tripId, isActive: true },
      select: ['seatNumber', 'passengerGender'],
    });
    const out: Record<string, 'MALE' | 'FEMALE'> = {};
    for (const s of seats) {
      const g = (s.passengerGender ?? '').toUpperCase();
      // Anything else — OTHER, blank, a typo — is simply not published. "Sold" is the honest
      // answer when we do not know, and inventing a gender would be worse than showing none.
      if (g === 'MALE' || g === 'M') out[s.seatNumber.toUpperCase()] = 'MALE';
      else if (g === 'FEMALE' || g === 'F') out[s.seatNumber.toUpperCase()] = 'FEMALE';
    }
    return out;
  }

  private async occupiedFor(tripId: string, board: number, drop: number): Promise<Set<string>> {
    const active = await this.seatRepo.find({ where: { tripId, isActive: true } });
    const holds = await this.holdRepo
      .createQueryBuilder('h')
      .where('h.tripId = :t', { t: tripId })
      .andWhere('h.active = true')
      .andWhere('h.expiresAt > NOW()')
      .getMany();
    const segs = [
      ...active.map((s) => ({ seatNumber: s.seatNumber, boardingOrder: s.boardingStopOrder, droppingOrder: s.droppingStopOrder })),
      ...holds.map((h) => ({ seatNumber: h.seatNumber, boardingOrder: h.boardingStopOrder, droppingOrder: h.droppingStopOrder })),
    ];
    return occupiedSeats(segs, board, drop);
  }

  countScheduledForOperator(operatorId: string) {
    return this.tripRepo.count({ where: { operatorId, status: TripStatus.SCHEDULED } });
  }

  listByOperator(operatorId: string, includeDeleted = false) {
    return this.tripRepo.find({ where: { operatorId }, order: { departureDate: 'DESC' }, withDeleted: includeDeleted });
  }

  async create(operatorId: string, dto: any) {
    const bus = await this.busRepo.findOne({ where: { id: dto.busId } });
    if (!bus) throw new AppException('BUS_NOT_FOUND', 'Bus not found', HttpStatus.NOT_FOUND);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'Bus does not belong to your operator', HttpStatus.FORBIDDEN);
    if (!bus.isActive) throw new AppException('BUS_INACTIVE', 'Bus is inactive', HttpStatus.BAD_REQUEST);

    const route = await this.routeRepo.findOne({ where: { id: dto.routeId } });
    if (!route) throw new AppException('ROUTE_NOT_FOUND', 'Route not found', HttpStatus.NOT_FOUND);
    if (route.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'Route does not belong to your operator', HttpStatus.FORBIDDEN);

    // ONE BUS -> ONE ROUTE invariant
    const check = checkBusRouteForTrip(bus.currentRouteId, dto.routeId);
    if (!check.ok) throw new AppException(check.code, check.message, HttpStatus.CONFLICT);

    const trip = await this.tripRepo.save(this.tripRepo.create({
      operatorId, routeId: dto.routeId, busId: dto.busId,
      departureDate: dto.departureDate, departureTime: dto.departureTime,
      fareMultiplier: dto.fareMultiplier ?? 1,
      // Take a copy of the bus's seating NOW (spec §24). From here, this trip's seats are its
      // own: republishing the layout, renumbering a row, retiring a seat — none of it can
      // reach backwards and change what a passenger already bought.
      seatSnapshot: {
        seatMap: [...(bus.seatMap ?? [])],
        totalSeats: bus.totalSeats,
        ladiesReservedSeats: [...(bus.ladiesReservedSeats ?? [])],
        seatAdjacency: { ...(bus.seatAdjacency ?? {}) },
        seatLayout: bus.seatLayout ?? null,
        layoutTemplateId: bus.layoutTemplateId ?? null,
        layoutVersion: bus.layoutVersion ?? null,
      },
    }));
    // The driver assigned to this bus is now on duty for this trip — notify them.
    try {
      const driver = await this.driverRepo.findOne({ where: { busId: bus.id } });
      if (driver?.email) await this.email.send({ to: driver.email, template: 'DRIVER_DUTY_ASSIGNED', vars: { name: driver.fullName, routeName: route.name, date: trip.departureDate, time: trip.departureTime, busReg: bus.registrationNumber, operatorName: 'Yoo Bus' }, operatorId, recipientOperatorId: operatorId });
    } catch (e) { this.logger.error(`Driver-duty email failed: ${(e as Error).message}`); }
    return trip;
  }

  /** Explicitly assign a driver to a trip and notify them of the duty. */
  async assignDriver(operatorId: string, tripId: string, driverId: string) {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip || trip.operatorId !== operatorId) throw new AppException('TRIP_NOT_FOUND', 'Trip not found', HttpStatus.NOT_FOUND);
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver || driver.operatorId !== operatorId) throw new AppException('DRIVER_NOT_FOUND', 'Driver not found', HttpStatus.NOT_FOUND);
    if (!driver.isActive) throw new AppException('DRIVER_INACTIVE', 'Driver is inactive', HttpStatus.BAD_REQUEST);
    trip.driverId = driverId;
    const saved = await this.tripRepo.save(trip);
    try {
      const route = await this.routeRepo.findOne({ where: { id: trip.routeId } });
      const bus = await this.busRepo.findOne({ where: { id: trip.busId } });
      if (driver.email) await this.email.send({ to: driver.email, template: 'DRIVER_DUTY_ASSIGNED', vars: { name: driver.fullName, routeName: route?.name ?? '', date: trip.departureDate, time: trip.departureTime, busReg: bus?.registrationNumber ?? '', operatorName: 'Yoo Bus' }, operatorId, recipientOperatorId: operatorId });
    } catch (e) { this.logger.error(`Assign-driver email failed: ${(e as Error).message}`); }
    return { tripId: saved.id, driverId, driverName: driver.fullName };
  }

  async findFull(id: string) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new AppException('TRIP_NOT_FOUND', 'Trip not found', HttpStatus.NOT_FOUND);
    const route = await this.routeRepo.findOne({ where: { id: trip.routeId } });
    const bus = await this.busRepo.findOne({ where: { id: trip.busId } });
    if (!route || !bus) throw new AppException('TRIP_DATA_MISSING', 'Trip route or bus data is missing', HttpStatus.NOT_FOUND);
    route.routeStops.sort((a, b) => a.stopOrder - b.stopOrder);
    return { trip, route, bus };
  }

  private stopFares(route: Route): RouteStopFare[] {
    return route.routeStops.map((rs) => ({ stopId: rs.stopId, stopOrder: rs.stopOrder, fareFromOrigin: Number(rs.fareFromOrigin) }));
  }

  /**
   * The seating THIS trip was sold on.
   *
   * Always prefer the trip's snapshot. Reading the live bus would mean a template published
   * this morning silently changes a trip that was sold last week. Trips created before
   * layouts existed have no snapshot, and fall back to the bus — exactly what they did
   * before, so nothing old breaks.
   */
  private seatingOf(trip: Trip, bus: Bus) {
    const snap = trip.seatSnapshot;
    return {
      seatMap: snap?.seatMap ?? bus.seatMap ?? [],
      totalSeats: snap?.totalSeats ?? bus.totalSeats,
      ladiesReservedSeats: snap?.ladiesReservedSeats ?? bus.ladiesReservedSeats ?? [],
      seatAdjacency: snap?.seatAdjacency ?? bus.seatAdjacency ?? {},
      seatLayout: snap?.seatLayout ?? bus.seatLayout ?? null,
    };
  }

  async getSeatAvailability(tripId: string, boardingStopId: string, droppingStopId: string) {
    const { trip, route, bus } = await this.findFull(tripId);
    const seating = this.seatingOf(trip, bus);
    const fares = this.stopFares(route);
    const fare = segmentFare(fares, boardingStopId, droppingStopId, Number(trip.fareMultiplier));
    if (fare < 0) throw new AppException('INVALID_SEGMENT', 'Boarding or dropping stop is invalid for this route or the direction is wrong', HttpStatus.BAD_REQUEST);
    // `!` here was a live crash: a stop that is not on this route made .find() return
    // undefined and the non-null assertion turned that into a TypeError -> 500.
    const boardStop = route.routeStops.find((r) => r.stopId === boardingStopId);
    const dropStop = route.routeStops.find((r) => r.stopId === droppingStopId);
    if (!boardStop || !dropStop) {
      throw new AppException(
        'INVALID_SEGMENT',
        'Boarding or dropping stop is not on this route.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const board = boardStop.stopOrder;
    const drop = dropStop.stopOrder;

    const taken = await this.occupiedFor(tripId, board, drop);

    // The seat map a passenger sees must carry EVERYTHING needed to draw it — otherwise the
    // client has to go and fetch the bus separately, and /buses/:id/seat-config is
    // OPERATOR_ADMIN-only, so a passenger simply cannot. Ladies-reserved seats especially:
    // marking them is a legal requirement in several states, not a nicety.
    const ladies = new Set(seating.ladiesReservedSeats);
    // Per-seat pricing: every seat carries its OWN price. A single `farePerSeat` for the
    // whole bus is kept below only as the standard-seat reference — the seat you tap is the
    // price you pay, and a lower berth is not the same price as the back row.
    const rules = bus.seatFares ?? {};
    const occupants = await this.occupantGenders(tripId);
    const seats = seating.seatMap.map((sn) => {
      const rule = rules[sn.toUpperCase()];
      const isTaken = taken.has(sn);
      const occupant = isTaken ? occupants[sn.toUpperCase()] : undefined;

      return {
        seatNumber: sn,
        available: !isTaken,
        ladiesReserved: ladies.has(sn),
        /**
         * The single field the whole seat-map colour scheme hangs on.
         *
         *   ladiesReserved + available  → pink outline   "available for female only"
         *   bookedBy = FEMALE           → pink fill      "booked by female"
         *   bookedBy = MALE             → blue fill      "booked by male"
         *   taken, gender unknown       → grey           "already booked"
         *
         * Only ever set on a seat that is actually taken. On a free seat it is undefined,
         * because nobody is sitting there and guessing would be a lie.
         */
        bookedBy: occupant,
        fare: seatFare(fare, 1, rule),
        /** Present only when this seat is priced differently from a standard one. */
        priceBand: rule ? (Number(rule.multiplier) > 1 ? 'PREMIUM' : Number(rule.multiplier) < 1 ? 'SAVER' : 'STANDARD') : 'STANDARD',
      };
    });
    const fromName = route.routeStops.find((r) => r.stopId === boardingStopId)?.stop?.name ?? '';
    const toName = route.routeStops.find((r) => r.stopId === droppingStopId)?.stop?.name ?? '';
    return {
      tripId,
      busName: bus.name,
      busType: bus.busType,
      /** The price of a STANDARD seat. Individual seats may cost more or less — see seats[]. */
      farePerSeat: fare,
      fareFrom: seats.length ? Math.min(...seats.map((s) => s.fare)) : fare,
      fareTo: seats.length ? Math.max(...seats.map((s) => s.fare)) : fare,
      totalSeats: bus.totalSeats,
      availableCount: seats.filter((s) => s.available).length,
      seats,
      /** The physical arrangement (rows/columns/deck), so the UI never hard-codes a layout. */
      seatLayout: seating.seatLayout,
      ladiesReservedSeats: seating.ladiesReservedSeats,
      seatAdjacency: bus.seatAdjacency ?? {},
      fromName,
      toName,
      date: trip.departureDate,
      operatorId: trip.operatorId,
    };
  }

  private daysTo(departureDate: string): number {
    const dep = new Date(departureDate + 'T00:00:00').getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((dep - now) / 86400000));
  }

  /** Effective (possibly dynamic) multiplier for a trip at a given occupancy. */
  private effectiveMultiplier(trip: Trip, occupancyPct: number): number {
    const base = Number(trip.fareMultiplier);
    if (this.config.get<string>('pricing.dynamicEnabled') !== 'true' && !this.config.get<boolean>('pricing.dynamicEnabled')) return base;
    const hour = parseInt((trip.departureTime || '00:00').slice(0, 2), 10);
    return dynamicFareMultiplier({ occupancyPct, daysToDeparture: this.daysTo(trip.departureDate), baseMultiplier: base, hour });
  }

  /** Marks a trip COMPLETED (after the journey). */
  async markCompleted(id: string, operatorId: string | null) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new AppException('TRIP_NOT_FOUND', 'Trip not found', HttpStatus.NOT_FOUND);
    if (operatorId && trip.operatorId !== operatorId) throw new AppException('FORBIDDEN', 'Not your trip', HttpStatus.FORBIDDEN);
    trip.status = TripStatus.COMPLETED;
    await this.tripRepo.save(trip);
    return { id: trip.id, status: trip.status };
  }

  /** Visual seat map for a trip + segment: layout cells enriched with live status. */
  async seatMap(tripId: string, boardingStopId: string, droppingStopId: string) {
    const { trip, route, bus } = await this.findFull(tripId);
    const boardRs = route.routeStops.find((r) => r.stopId === boardingStopId);
    const dropRs = route.routeStops.find((r) => r.stopId === droppingStopId);
    if (!boardRs || !dropRs || boardRs.stopOrder >= dropRs.stopOrder) {
      throw new AppException('INVALID_SEGMENT', 'Boarding or dropping stop is invalid for this route.', HttpStatus.BAD_REQUEST);
    }
    const taken = await this.occupiedFor(tripId, boardRs.stopOrder, dropRs.stopOrder);
    const totalSeats = bus.totalSeats;
    const availableCount = bus.seatMap.filter((sn) => !taken.has(sn)).length;
    const occupancyPct = totalSeats > 0 ? (totalSeats - availableCount) / totalSeats : 0;

    const baseFare = segmentFare(this.stopFares(route), boardingStopId, droppingStopId, Number(trip.fareMultiplier));
    const effMult = this.effectiveMultiplier(trip, occupancyPct);
    const farePerSeat = applyDynamicFare(baseFare, Number(trip.fareMultiplier), effMult);

    const decks = (bus.seatLayout?.decks ?? []).map((deck: any) => ({
      ...deck,
      cells: (deck.cells ?? []).map((c: any) =>
        c && c.type === 'seat' && c.seatNumber
          ? { ...c, status: taken.has(c.seatNumber) ? 'BOOKED' : 'AVAILABLE',
              window: !!(c.attrs && c.attrs.window), ladies: !!(c.attrs && c.attrs.ladies) }
          : c),
    }));
    return {
      tripId, totalSeats, availableCount, occupancyPct: Math.round(occupancyPct * 100) / 100,
      baseFarePerSeat: baseFare, farePerSeat, dynamicPricing: effMult !== Number(trip.fareMultiplier), effectiveMultiplier: effMult,
      legend: { AVAILABLE: 'open', BOOKED: 'sold', window: 'window seat', ladies: 'ladies seat' },
      decks,
    };
  }

  async search(fromStopId: string, toStopId: string, date?: string, operatorId?: string | null) {
    const qb = this.tripRepo.createQueryBuilder('t').where('t.status = :s', { s: TripStatus.SCHEDULED });
    if (date) qb.andWhere('t.departureDate = :d', { d: date });
    if (operatorId) qb.andWhere('t.operatorId = :op', { op: operatorId }); // white-label: scope to the domain's operator
    const trips = await qb.getMany();
    const out: any[] = [];
    for (const trip of trips) {
      const route = await this.routeRepo.findOne({ where: { id: trip.routeId } });
      const bus = await this.busRepo.findOne({ where: { id: trip.busId } });
      if (!route || !bus) continue;
      route.routeStops.sort((a, b) => a.stopOrder - b.stopOrder);
      const board = route.routeStops.find((r) => r.stopId === fromStopId);
      const drop = route.routeStops.find((r) => r.stopId === toStopId);
      if (!board || !drop || board.stopOrder >= drop.stopOrder) continue;
      const fare = segmentFare(this.stopFares(route), fromStopId, toStopId, Number(trip.fareMultiplier));
      const taken = await this.occupiedFor(trip.id, board.stopOrder, drop.stopOrder);
      out.push({
        tripId: trip.id, operatorId: trip.operatorId, routeName: route.name,
        bus: { name: bus.name, type: bus.busType, registrationNumber: bus.registrationNumber },
        departureDate: trip.departureDate, departureTime: trip.departureTime,
        // The stop IDs, not just their names. Holding a seat needs boardingStopId and
        // droppingStopId, and the client has no other way to learn them — without these
        // a search result could be displayed but never actually booked.
        fromStopId: board.stopId, toStopId: drop.stopId,
        from: board.stop?.name, to: drop.stop?.name, farePerSeat: fare,
        availableSeats: bus.totalSeats - taken.size,
      });
    }
    return out;
  }

  async cancel(operatorId: string, id: string) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new AppException('TRIP_NOT_FOUND', 'Trip not found', HttpStatus.NOT_FOUND);
    if (trip.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This trip does not belong to your operator', HttpStatus.FORBIDDEN);
    trip.status = TripStatus.CANCELLED;
    const saved = await this.tripRepo.save(trip);
    // Operator cancelled the trip: cancel each confirmed booking, record a full source refund,
    // and notify the passenger. Failures here never block the trip cancellation.
    try {
      const affected = await this.bookingRepo.find({ where: { tripId: id, status: BookingStatus.CONFIRMED } });
      for (const b of affected) {
        b.status = BookingStatus.CANCELLED;
        b.cancelReason = 'Trip cancelled by operator';
        await this.bookingRepo.save(b);
        await this.refundRepo.save(this.refundRepo.create({
          bookingId: b.id, userId: b.userId, amountPaid: Number(b.payableByPassenger), refundPct: 1,
          refundAmount: Number(b.payableByPassenger), cancellationCharge: 0, mode: 'SOURCE', status: 'INITIATED',
        }));
        const u = await this.userRepo.findOne({ where: { id: b.userId } });
        if (u?.email) await this.email.send({ to: u.email, template: 'TRIP_CANCELLED', vars: { name: u.fullName, pnr: b.pnr, date: trip.departureDate, from: '', to: '', refund: Number(b.payableByPassenger), operatorName: 'Yoo Bus' }, operatorId, recipientOperatorId: null });
      }
    } catch (e) { this.logger.error(`Trip-cancel notifications failed: ${(e as Error).message}`); }
    return saved;
  }
  private readonly logger = new Logger('Trips');

  /** Scheduled trips for a date, each with its sorted route and bus (for journey search). */
  async candidatesForDate(date?: string, operatorId?: string | null) {
    const qb = this.tripRepo.createQueryBuilder('t').where('t.status = :s', { s: TripStatus.SCHEDULED });
    if (date) qb.andWhere('t.departureDate = :d', { d: date });
    if (operatorId) qb.andWhere('t.operatorId = :op', { op: operatorId });
    const trips = await qb.getMany();
    const out: { trip: Trip; route: Route; bus: any }[] = [];
    for (const trip of trips) {
      const route = await this.routeRepo.findOne({ where: { id: trip.routeId } });
      const bus = await this.busRepo.findOne({ where: { id: trip.busId } });
      if (!route || !bus) continue;
      route.routeStops.sort((a, b) => a.stopOrder - b.stopOrder);
      out.push({ trip, route, bus });
    }
    return out;
  }

  /** Segment fare helper reused by journey search (single fare home). */
  segmentFareFor(route: Route, fromStopId: string, toStopId: string, multiplier: number) {
    return segmentFare(this.stopFares(route), fromStopId, toStopId, multiplier);
  }

}