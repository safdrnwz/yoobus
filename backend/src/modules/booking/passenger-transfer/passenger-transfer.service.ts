import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { customAlphabet } from 'nanoid';
import { TransferRecord } from './entities/transfer-record.entity';
import { InitiateTransferDto } from './dto/transfer.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { UsersService } from '../../customer/users/users.service';
import { EmailService } from '../../integrations/email/email.service';
import { AppException } from '../../../common/errors/app-exception';
import { canInitiateTransfer, transferCanTransition, TransferStatus } from '../../../common/logic/transfer.util';

const pnrGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

/** Passenger transfer / bus exchange: initiate, approve, execute (regenerate ticket). */
@Injectable()
export class PassengerTransferService {
  constructor(
    @InjectRepository(TransferRecord) private readonly repo: Repository<TransferRecord>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly users: UsersService,
    private readonly email: EmailService,
  ) {}

  async initiate(operatorId: string, dto: InitiateTransferDto): Promise<TransferRecord> {
    const booking = await this.bookingRepo.findOne({ where: { id: dto.bookingId } });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'Booking not found.', HttpStatus.NOT_FOUND);
    if (booking.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This booking does not belong to your operator.', HttpStatus.FORBIDDEN);
    const guard = canInitiateTransfer(booking.status, booking.tripId, dto.toTripId);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    const record = await this.repo.save(this.repo.create({
      operatorId, bookingId: dto.bookingId, fromTripId: booking.tripId, toTripId: dto.toTripId,
      reason: dto.reason ?? null, status: 'INITIATED',
    }));
    try {
      const u = await this.users.findById(booking.userId);
      if (u?.email) await this.email.send({ to: u.email, template: 'PASSENGER_TRANSFER_DONE', vars: { name: u.fullName, newPnr: booking.pnr, operatorName: 'Yoo Bus' }, operatorId, recipientOperatorId: null });
    } catch (e) { this.logger.error(`Transfer email failed: ${(e as Error).message}`); }
    return record;
  }
  private readonly logger = new Logger('PassengerTransfer');

  private async require(operatorId: string, id: string): Promise<TransferRecord> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t || t.operatorId !== operatorId) throw new AppException('TRANSFER_NOT_FOUND', 'Transfer not found.', HttpStatus.NOT_FOUND);
    return t;
  }

  private async transition(operatorId: string, id: string, to: TransferStatus): Promise<TransferRecord> {
    const t = await this.require(operatorId, id);
    const guard = transferCanTransition(t.status, to);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    t.status = to;
    return this.repo.save(t);
  }

  approve(operatorId: string, id: string): Promise<TransferRecord> {
    return this.transition(operatorId, id, 'APPROVED');
  }
  cancel(operatorId: string, id: string): Promise<TransferRecord> {
    return this.transition(operatorId, id, 'CANCELLED');
  }

  /** Moves the booking to the target trip and regenerates its PNR (new ticket/QR). */
  async execute(operatorId: string, id: string): Promise<TransferRecord> {
    const t = await this.require(operatorId, id);
    const guard = transferCanTransition(t.status, 'EXECUTED');
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    const booking = await this.bookingRepo.findOne({ where: { id: t.bookingId } });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'Booking not found.', HttpStatus.NOT_FOUND);
    booking.tripId = t.toTripId;
    booking.pnr = pnrGen();
    await this.bookingRepo.save(booking);
    t.status = 'EXECUTED';
    t.regeneratedPnr = booking.pnr;
    return this.repo.save(t);
  }

  listForBooking(operatorId: string, bookingId: string): Promise<TransferRecord[]> {
    return this.repo.find({ where: { operatorId, bookingId }, order: { createdAt: 'DESC' } });
  }
}
