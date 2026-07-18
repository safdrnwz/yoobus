import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FareLock } from './entities/fare-lock.entity';
import { FreezeFareDto } from './dto/fare-freeze.dto';
import { TripsService } from '../../operator/trips/trips.service';
import { AppException } from '../../../common/errors/app-exception';
import { UsersService } from '../../customer/users/users.service';
import { EmailService } from '../../integrations/email/email.service';
import { Logger } from '@nestjs/common';

/** Fare freeze: pay a small fee to lock today's price for a few hours, even if fares rise. */
@Injectable()
export class FareFreezeService {
  constructor(
    @InjectRepository(FareLock) private readonly repo: Repository<FareLock>,
    private readonly trips: TripsService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly email: EmailService,
  ) {}

  private readonly logger = new Logger('FareFreeze');

  async freeze(userId: string, tripId: string, dto: FreezeFareDto) {
    const avail = await this.trips.getSeatAvailability(tripId, dto.boardingStopId, dto.droppingStopId);
    if (avail.availableCount <= 0) throw new AppException('TRIP_FULL', 'No seats to freeze a fare for right now.', HttpStatus.CONFLICT);
    const fee = this.config.get<number>('fareFreeze.fee')!;
    const hours = this.config.get<number>('fareFreeze.hours')!;
    const lock = await this.repo.save(this.repo.create({
      token: randomUUID(), userId, tripId, boardingStopId: dto.boardingStopId, droppingStopId: dto.droppingStopId,
      lockedFarePerSeat: avail.farePerSeat, feeAmount: fee, status: 'ACTIVE',
      expiresAt: new Date(Date.now() + hours * 3600 * 1000),
    }));
    try {
      const u = await this.users.findById(userId);
      if (u?.email) await this.email.send({ to: u.email, template: 'FARE_FROZEN', vars: { name: u.fullName, lockedFarePerSeat: lock.lockedFarePerSeat, expiresAt: lock.expiresAt, hours }, operatorId: null });
    } catch (e) { this.logger.error(`Fare-frozen email failed: ${(e as Error).message}`); }
    return { freezeToken: lock.token, lockedFarePerSeat: lock.lockedFarePerSeat, fee, expiresAt: lock.expiresAt,
      message: `Fare locked for ${hours} hours. Use this freeze token when you book.` };
  }

  /** Resolve a valid, unexpired lock for a segment. Returns null if none applies. */
  async resolve(token: string, tripId: string, boardingStopId: string, droppingStopId: string): Promise<FareLock | null> {
    if (!token) return null;
    const lock = await this.repo.findOne({ where: { token, tripId, boardingStopId, droppingStopId, status: 'ACTIVE' } });
    if (!lock) return null;
    if (lock.expiresAt.getTime() <= Date.now()) { lock.status = 'EXPIRED'; await this.repo.save(lock); return null; }
    return lock;
  }

  async markUsed(token: string): Promise<void> {
    await this.repo.update({ token }, { status: 'USED' });
  }
}
