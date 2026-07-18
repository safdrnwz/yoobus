import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { TripsService } from '../../operator/trips/trips.service';
import { BookingsService } from '../../booking/bookings/bookings.service';
import { User } from '../../customer/users/entities/user.entity';
import { Role } from '../../../common/enums/role.enum';
import { AppException } from '../../../common/errors/app-exception';
import { OtaBlockDto, OtaConfirmDto, OtaSearchDto } from './dto/ota.dto';

/** OTA distribution: lets partners (redBus, AbhiBus, …) search, block, confirm and cancel
 *  Yoo Bus inventory through a single API. Bookings are tagged with the OTA channel. */
@Injectable()
export class OtaService {
  constructor(
    private readonly trips: TripsService,
    private readonly bookings: BookingsService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /** A stable per-partner service account under which OTA bookings are created. */
  private async partnerUser(partnerId: string): Promise<string> {
    const email = `ota+${partnerId}@yoobus.com`;
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) return existing.id;
    // Service account: unguessable random password (never used for login), satisfies the NOT NULL column.
    const randomHash = await bcrypt.hash(randomUUID() + 'A1@', 10);
    const created = this.userRepo.create({ email, fullName: 'OTA Partner', role: Role.CUSTOMER, isActive: true, passwordSet: false, password: randomHash } as Partial<User>);
    const saved = await this.userRepo.save(created);
    return saved.id;
  }

  /** Available trips + fare for a route/date. */
  async search(dto: OtaSearchDto) {
    const trips = await this.trips.search(dto.fromStopId, dto.toStopId, dto.date);
    return { count: trips.length, trips };
  }

  /** Seat map for a specific trip + segment. */
  seatMap(tripId: string, boardingStopId: string, droppingStopId: string) {
    return this.trips.seatMap(tripId, boardingStopId, droppingStopId);
  }

  /** Hold seats; returns a holdToken the OTA passes to confirm. */
  block(dto: OtaBlockDto) {
    return this.bookings.hold(dto);
  }

  /** Confirm the held seats into a paid booking tagged to the OTA channel. */
  async confirm(partnerId: string, dto: OtaConfirmDto) {
    const userId = await this.partnerUser(partnerId);
    const created = await this.bookings.createFromHold(userId, {
      holdToken: dto.holdToken,
      passengers: dto.passengers.map((p) => ({ seatNumber: p.seatNumber, name: p.name, age: p.age ?? 30, gender: p.gender ?? 'OTHER' })),
      source: 'OTA', channelCode: dto.channelCode ?? 'OTA', otaRef: dto.otaRef,
    });
    // OTA collects payment on their side and remits to the operator, so confirm immediately.
    await this.bookings.confirmPayment(created.bookingId);
    return { pnr: created.pnr, bookingId: created.bookingId, status: 'CONFIRMED', otaRef: dto.otaRef };
  }

  status(pnr: string) { return this.bookings.findByPnr(pnr); }

  async cancel(pnr: string) {
    const bookingRow = await this.bookings.findByPnrRaw(pnr);
    if (!bookingRow?.id) throw new AppException('PNR_NOT_FOUND', 'PNR not found', HttpStatus.NOT_FOUND);
    // The OTA channel cancels on behalf of the booking's own service user (the resource owner).
    return this.bookings.cancel(bookingRow.id, { id: bookingRow.userId, role: Role.CUSTOMER, operatorId: null }, 'Cancelled via OTA');
  }
}
