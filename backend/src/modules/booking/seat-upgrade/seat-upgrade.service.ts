import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UpgradeOffer } from './entities/upgrade-offer.entity';
import { OfferUpgradeDto } from './dto/upgrade.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { UsersService } from '../../customer/users/users.service';
import { EmailService } from '../../integrations/email/email.service';
import { AppException } from '../../../common/errors/app-exception';
import { canOfferUpgrade, upgradeFareDifference } from '../../../common/logic/seat-upgrade.util';

/** Seat-upgrade engine: offer, apply, reject upgrades against confirmed bookings. */
@Injectable()
export class SeatUpgradeService {
  constructor(
    @InjectRepository(UpgradeOffer) private readonly repo: Repository<UpgradeOffer>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly users: UsersService,
    private readonly email: EmailService,
  ) {}

  async offer(operatorId: string, dto: OfferUpgradeDto): Promise<UpgradeOffer> {
    const booking = await this.bookingRepo.findOne({ where: { id: dto.bookingId } });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'Booking not found.', HttpStatus.NOT_FOUND);
    if (booking.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This booking does not belong to your operator.', HttpStatus.FORBIDDEN);
    const guard = canOfferUpgrade(booking.status, dto.fromCategory, dto.toCategory);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    const fareDifference = upgradeFareDifference(dto.fromPrice, dto.toPrice, dto.complimentary ?? false);
    const offer = await this.repo.save(this.repo.create({
      operatorId, bookingId: dto.bookingId, fromCategory: dto.fromCategory, toCategory: dto.toCategory,
      complimentary: dto.complimentary ?? false, fareDifference, status: 'OFFERED',
    }));
    try {
      const u = await this.users.findById(booking.userId);
      if (u?.email) await this.email.send({ to: u.email, template: 'SEAT_UPGRADE_OFFER', vars: { name: u.fullName, pnr: booking.pnr, fromCategory: dto.fromCategory, toCategory: dto.toCategory, fareDifference, operatorName: 'Yoo Bus' }, operatorId, recipientOperatorId: null });
    } catch (e) { this.logger.error(`Upgrade offer email failed: ${(e as Error).message}`); }
    return offer;
  }
  private readonly logger = new Logger('SeatUpgrade');

  private async require(operatorId: string, id: string): Promise<UpgradeOffer> {
    const o = await this.repo.findOne({ where: { id } });
    if (!o || o.operatorId !== operatorId) throw new AppException('UPGRADE_NOT_FOUND', 'Upgrade offer not found.', HttpStatus.NOT_FOUND);
    return o;
  }

  async apply(operatorId: string, id: string): Promise<UpgradeOffer> {
    const o = await this.require(operatorId, id);
    if (o.status !== 'OFFERED') throw new AppException('UPGRADE_NOT_OFFERED', 'Only an open offer can be applied.', HttpStatus.BAD_REQUEST);
    o.status = 'APPLIED';
    return this.repo.save(o);
  }
  async reject(operatorId: string, id: string): Promise<UpgradeOffer> {
    const o = await this.require(operatorId, id);
    if (o.status !== 'OFFERED') throw new AppException('UPGRADE_NOT_OFFERED', 'Only an open offer can be rejected.', HttpStatus.BAD_REQUEST);
    o.status = 'REJECTED';
    return this.repo.save(o);
  }
  listForBooking(operatorId: string, bookingId: string): Promise<UpgradeOffer[]> {
    return this.repo.find({ where: { operatorId, bookingId }, order: { createdAt: 'DESC' } });
  }
}
