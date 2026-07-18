import { adjustSeatFares, isValidSeatFareRule, SeatFareMap } from '../../../common/logic/fare.util';
import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { User } from '../../customer/users/entities/user.entity';
import { Role } from '../../../common/enums/role.enum';
import { EmailService } from '../../integrations/email/email.service';
import { Repository } from 'typeorm';
import { Bus } from './entities/bus.entity';
import { AMENITY_CATALOG, BusAmenity } from './entities/bus-amenity.entity';
import { Route } from '../routes/entities/route.entity';
import { Trip } from '../trips/entities/trip.entity';
import { SetupInvoice } from '../../finance/billing/entities/setup-invoice.entity';
import { AppException } from '../../../common/errors/app-exception';
import { checkBusRegUnique, checkRouteChangeAllowed } from '../../../common/logic/invariants.util';
import { canDelete } from '../../../common/logic/delete-permission.util';
import { TripStatus } from '../../../common/enums/trip-status.enum';

@Injectable()
export class BusesService {
  private readonly logger = new Logger('Buses');
  constructor(
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(SetupInvoice) private readonly invoiceRepo: Repository<SetupInvoice>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(BusAmenity) private readonly amenityRepo: Repository<BusAmenity>,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // create => reg globally unique + setup invoice (idempotent per bus)
  async create(operatorId: string, setupFeePerBus: number, dto: any) {
    const allRegs = (await this.busRepo.find({ select: ['registrationNumber'] })).map((b) => b.registrationNumber);
    const uniq = checkBusRegUnique(dto.registrationNumber, allRegs);
    if (!uniq.ok) throw new AppException(uniq.code, uniq.message, HttpStatus.CONFLICT);

    const seatMap = dto.seatMap?.length ? dto.seatMap : Array.from({ length: dto.totalSeats }, (_, i) => `${i + 1}`);
    const seatLayout = dto.seatLayout || { decks: [{ rows: Math.ceil(dto.totalSeats / 4), cols: 4, cells: seatMap.map((s: string) => ({ type: 'seat', seatNumber: s })) }] };

    await this.assertVehicleIdentityUnique(operatorId, dto.vehicleDetails, dto.fleetNumber);

    const bus = await this.busRepo.save(this.busRepo.create({
      registrationNumber: dto.registrationNumber.toUpperCase().replace(/\s+/g, ''),
      operatorId, name: dto.name, busType: dto.busType, totalSeats: dto.totalSeats,
      seatMap, seatLayout,
      fleetNumber: dto.fleetNumber ?? null,
      ownershipType: dto.ownershipType ?? null,
      busCategory: dto.busCategory ?? null,
      registrationDate: dto.registrationDate ?? null,
      vehicleDetails: dto.vehicleDetails ?? {},
      createdBy: dto.createdBy ?? null,
    }));

    // One-time setup invoice (idempotent: exactly one per bus).
    if (!bus.setupFeeInvoiced) {
      const count = await this.invoiceRepo.count();
      const invoiceNumber = 'TB-SU-' + String(count + 1).padStart(6, '0');
      await this.invoiceRepo.save(this.invoiceRepo.create({
        operatorId, busId: bus.id, invoiceNumber, amount: setupFeePerBus, status: 'UNPAID',
      }));
      bus.setupFeeInvoiced = true;
      await this.busRepo.save(bus);
      try {
        const admins = await this.userRepo.find({ where: { operatorId, role: Role.OPERATOR_ADMIN } });
        for (const a of admins) await this.email.send({ to: a.email, template: 'SETUP_INVOICE', vars: { operatorName: a.fullName, invoiceNumber, amount: setupFeePerBus, busReg: (bus as any).registrationNumber ?? (bus as any).regNo ?? bus.id.slice(0, 8) }, operatorId, recipientOperatorId: operatorId });
      } catch (e) { this.logger.error(`Setup-invoice email failed: ${(e as Error).message}`); }
    }
    return bus;
  }

  async findById(id: string) {
    const b = await this.busRepo.findOne({ where: { id } });
    if (!b) throw new AppException('BUS_NOT_FOUND', 'Bus not found', HttpStatus.NOT_FOUND);
    return b;
  }

  listByOperator(operatorId: string, includeDeleted = false) { return this.busRepo.find({ where: { operatorId }, order: { createdAt: 'DESC' }, withDeleted: includeDeleted }); }

  // one bus -> one route: map
  async mapRoute(operatorId: string, busId: string, routeId: string) {
    const bus = await this.findById(busId);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    if (!route) throw new AppException('ROUTE_NOT_FOUND', 'Route not found', HttpStatus.NOT_FOUND);
    if (route.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This route does not belong to your operator', HttpStatus.FORBIDDEN);

    // route change: pending upcoming trips ho to block
    if (bus.currentRouteId && bus.currentRouteId !== routeId) {
      const pending = await this.tripRepo.count({ where: { busId: bus.id, status: TripStatus.SCHEDULED } });
      const allow = checkRouteChangeAllowed(pending);
      if (!allow.ok) throw new AppException(allow.code, allow.message, HttpStatus.CONFLICT);
    }
    bus.currentRouteId = routeId;
    return this.busRepo.save(bus);
  }

  /**
   * Bus Master §4.B — chassis/engine numbers and the fleet number must be unique
   * within the operator, where supplied. jsonb keys cannot carry a portable partial
   * unique index, so the invariant lives here.
   */
  private async assertVehicleIdentityUnique(
    operatorId: string,
    details?: { chassisNumber?: string; engineNumber?: string } | null,
    fleetNumber?: string | null,
    excludeBusId?: string,
  ) {
    const siblings = (await this.busRepo.find({ where: { operatorId } }))
      .filter((b) => b.id !== excludeBusId);
    const clash = (label: string, value?: string | null, pick?: (b: Bus) => string | undefined) => {
      if (!value) return;
      const v = value.trim().toUpperCase();
      if (v && siblings.some((b) => (pick!(b) ?? '').trim().toUpperCase() === v)) {
        throw new AppException('DUPLICATE_' + label, `${label.replace('_', ' ')} "${value}" is already used by another bus of this operator.`, HttpStatus.CONFLICT);
      }
    };
    clash('FLEET_NUMBER', fleetNumber, (b) => b.fleetNumber ?? undefined);
    clash('CHASSIS_NUMBER', details?.chassisNumber, (b) => b.vehicleDetails?.chassisNumber);
    clash('ENGINE_NUMBER', details?.engineNumber, (b) => b.vehicleDetails?.engineNumber);
  }

  async update(operatorId: string, id: string, patch: { name?: string; busType?: any; seatMap?: string[]; seatLayout?: any; fleetNumber?: string; ownershipType?: any; busCategory?: any; registrationDate?: string; vehicleDetails?: any; updatedBy?: string }) {
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    if (patch.fleetNumber !== undefined || patch.vehicleDetails !== undefined) {
      await this.assertVehicleIdentityUnique(operatorId, patch.vehicleDetails ?? bus.vehicleDetails, patch.fleetNumber ?? bus.fleetNumber, bus.id);
    }
    if (patch.name !== undefined) bus.name = patch.name;
    if (patch.busType !== undefined) bus.busType = patch.busType;
    if (patch.seatMap !== undefined) bus.seatMap = patch.seatMap;
    if (patch.seatLayout !== undefined) bus.seatLayout = patch.seatLayout;
    if (patch.fleetNumber !== undefined) bus.fleetNumber = patch.fleetNumber;
    if (patch.ownershipType !== undefined) bus.ownershipType = patch.ownershipType;
    if (patch.busCategory !== undefined) bus.busCategory = patch.busCategory;
    if (patch.registrationDate !== undefined) bus.registrationDate = patch.registrationDate;
    if (patch.vehicleDetails !== undefined) bus.vehicleDetails = { ...(bus.vehicleDetails ?? {}), ...patch.vehicleDetails };
    if (patch.updatedBy !== undefined) bus.updatedBy = patch.updatedBy;
    return this.busRepo.save(bus);
  }

  async setActive(operatorId: string, id: string, active: boolean) {
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    bus.isActive = active;
    // Keep the lifecycle status in step with the legacy boolean.
    if (active) bus.busStatus = 'ACTIVE';
    else if (bus.busStatus === 'ACTIVE') bus.busStatus = 'INACTIVE';
    return this.busRepo.save(bus);
  }

  /**
   * Bus Master §3.A.7 / §16.4 — lifecycle status transition. `isActive` (which the
   * whole booking chain reads) stays synced: only ACTIVE buses are bookable.
   */
  async setStatus(operatorId: string, id: string, status: Bus['busStatus'], updatedBy?: string) {
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    bus.busStatus = status;
    bus.isActive = status === 'ACTIVE';
    if (updatedBy) bus.updatedBy = updatedBy;
    return this.busRepo.save(bus);
  }

  /**
   * Bus Master §7.E — amenities, stored separately from the Bus row.
   * Replaces the whole set (idempotent PUT semantics); validates against the catalogue.
   */
  async setAmenities(operatorId: string, busId: string, amenities: string[]) {
    const bus = await this.findById(busId);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    const wanted = [...new Set((amenities ?? []).map((a) => a.trim().toUpperCase()))];
    const invalid = wanted.filter((a) => !(AMENITY_CATALOG as readonly string[]).includes(a));
    if (invalid.length) {
      throw new AppException('INVALID_AMENITY', `Unknown amenity(ies): ${invalid.join(', ')}. Allowed: ${AMENITY_CATALOG.join(', ')}`, HttpStatus.BAD_REQUEST);
    }
    await this.amenityRepo.delete({ busId });
    if (wanted.length) {
      await this.amenityRepo.save(wanted.map((a) => this.amenityRepo.create({ operatorId, busId, amenity: a as any })));
    }
    return { busId, amenities: wanted };
  }

  async getAmenities(operatorId: string, busId: string) {
    const bus = await this.findById(busId);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    const rows = await this.amenityRepo.find({ where: { busId }, order: { amenity: 'ASC' } });
    return { busId, amenities: rows.map((r) => r.amenity) };
  }

  /**
   * Requirement 8 — operator configures which seats are ladies-reserved.
   * Validates that every seat number actually exists on this bus's seat map.
   */
  async configureLadiesReserved(operatorId: string, id: string, seatNumbers: string[]) {
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    const validSeats = new Set((bus.seatMap ?? []).map((s) => s.toUpperCase()));
    const invalid = (seatNumbers ?? []).filter((s) => !validSeats.has(s.toUpperCase()));
    if (invalid.length) throw new AppException('INVALID_SEAT', `These seats do not exist on this bus: ${invalid.join(', ')}`, HttpStatus.BAD_REQUEST);
    bus.ladiesReservedSeats = (seatNumbers ?? []).map((s) => s.toUpperCase());
    return this.busRepo.save(bus);
  }

  /**
   * Requirement 10 — operator configures paired-seat adjacency for gender rules.
   * Accepts pairs like [["L3","L4"], ["U7","U8"]] and stores a bidirectional map.
   */
  async setSeatAdjacency(operatorId: string, id: string, pairs: [string, string][]) {
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    const validSeats = new Set((bus.seatMap ?? []).map((s) => s.toUpperCase()));
    const map: Record<string, string> = {};
    for (const [a, b] of pairs ?? []) {
      const ua = a.toUpperCase(), ub = b.toUpperCase();
      if (!validSeats.has(ua) || !validSeats.has(ub)) throw new AppException('INVALID_SEAT', `Seat pair ${a}/${b} contains a seat not on this bus`, HttpStatus.BAD_REQUEST);
      map[ua] = ub; map[ub] = ua;
    }
    bus.seatAdjacency = map;
    return this.busRepo.save(bus);
  }

  /**
   * Set the exact price rule for one or more seats.
   *
   * A rule is a multiplier on the base segment fare, optionally plus a flat premium. Seats
   * not mentioned keep whatever they had; send `{ multiplier: 1 }` to put a seat back to
   * standard.
   */
  async setSeatFares(
    operatorId: string,
    id: string,
    fares: Array<{ seatNumber: string; multiplier: number; delta?: number }>,
  ) {
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId)
      throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);

    const validSeats = new Set((bus.seatMap ?? []).map((s) => s.toUpperCase()));
    const next: SeatFareMap = { ...(bus.seatFares ?? {}) };

    for (const rule of fares ?? []) {
      const key = rule.seatNumber.toUpperCase();
      if (!validSeats.has(key))
        throw new AppException('INVALID_SEAT', `Seat ${rule.seatNumber} is not on this bus`, HttpStatus.BAD_REQUEST);
      const check = isValidSeatFareRule(rule);
      if (!check.ok)
        throw new AppException(check.code!, `Seat ${rule.seatNumber}: ${check.message}`, HttpStatus.BAD_REQUEST);
      next[key] = {
        multiplier: Number(rule.multiplier),
        ...(rule.delta !== undefined ? { delta: Number(rule.delta) } : {}),
      };
    }

    bus.seatFares = next;
    return this.busRepo.save(bus);
  }

  /**
   * Move prices in bulk.
   *
   * "Everything up 5%" is the common case, but not the only one — a Monday departure might
   * want the front half dearer and the back row cheaper. Omit `seats` and the whole bus
   * moves; name them and only those move.
   *
   * `percent` is a CHANGE, not a target: applying +5 twice compounds, which is what an
   * operator means when they say it twice.
   */
  async adjustSeatFares(
    operatorId: string,
    id: string,
    change: { percent?: number; delta?: number; setMultiplier?: number; seats?: string[] },
  ) {
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId)
      throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);

    const allSeats = (bus.seatMap ?? []).map((s) => s.toUpperCase());
    const result = adjustSeatFares(bus.seatFares ?? {}, allSeats, {
      ...change,
      seats: change.seats?.map((s) => s.toUpperCase()),
    });
    if (!result.ok) throw new AppException(result.code, result.message, HttpStatus.BAD_REQUEST);

    bus.seatFares = result.map;
    return this.busRepo.save(bus);
  }

  async getSeatConfig(operatorId: string, id: string) {
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    return { busId: bus.id, ladiesReservedSeats: bus.ladiesReservedSeats ?? [], seatAdjacency: bus.seatAdjacency ?? {} };
  }

  // Cross-operator delete for SuperAdmin (single home for bus delete logic).
  async adminSoftDelete(role: string, id: string) {
    const perm = canDelete(role, 'BUS');
    if (!perm.ok) throw new AppException(perm.code!, 'Delete not allowed', HttpStatus.FORBIDDEN);
    await this.findById(id);
    const active = await this.tripRepo.count({ where: { busId: id, status: TripStatus.SCHEDULED } });
    if (active > 0) throw new AppException('BUS_HAS_TRIPS', 'Bus has scheduled trips', HttpStatus.CONFLICT);
    await this.busRepo.softDelete(id);
    return { id, deleted: true };
  }

  async softDelete(role: string, operatorId: string, id: string) {
    const perm = canDelete(role, 'BUS');
    if (!perm.ok) throw new AppException(perm.code!, 'Delete not allowed', HttpStatus.FORBIDDEN);
    const bus = await this.findById(id);
    if (bus.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This bus does not belong to your operator', HttpStatus.FORBIDDEN);
    const active = await this.tripRepo.count({ where: { busId: id, status: TripStatus.SCHEDULED } });
    if (active > 0) throw new AppException('BUS_HAS_TRIPS', 'Bus has scheduled trips', HttpStatus.CONFLICT);
    await this.busRepo.softDelete(id);
    return { id, deleted: true };
  }
}
