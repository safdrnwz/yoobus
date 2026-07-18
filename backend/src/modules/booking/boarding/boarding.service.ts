import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardingRecord } from './entities/boarding-record.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { AppException } from '../../../common/errors/app-exception';
import { canBoard, parseTicketToken } from '../../../common/logic/boarding.util';

/** Boarding & QR validation: scan tickets, mark boarded / no-show, view boarding list. */
@Injectable()
export class BoardingService {
  constructor(
    @InjectRepository(BoardingRecord) private readonly repo: Repository<BoardingRecord>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
  ) {}

  /** Boarding list = confirmed bookings on the trip with their boarding outcome (if any). */
  async boardingList(operatorId: string, tripId: string) {
    const bookings = await this.bookingRepo.find({ where: { operatorId, tripId } });
    const records = await this.repo.find({ where: { operatorId, tripId } });
    const byBooking = new Map(records.map((r) => [r.bookingId, r.outcome]));
    return bookings.map((b) => ({ bookingId: b.id, pnr: b.pnr, status: b.status, boarding: byBooking.get(b.id) ?? 'PENDING' }));
  }

  private async findBookingByPnr(operatorId: string, tripId: string, pnr: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({ where: { pnr } });
    if (!booking) throw new AppException('BOOKING_NOT_FOUND', 'No booking matches this ticket.', HttpStatus.NOT_FOUND);
    if (booking.operatorId !== operatorId) throw new AppException('CROSS_OPERATOR_FORBIDDEN', 'This ticket belongs to another operator.', HttpStatus.FORBIDDEN);
    if (booking.tripId !== tripId) throw new AppException('BOARDING_WRONG_TRIP', 'This ticket is for a different trip.', HttpStatus.BAD_REQUEST);
    return booking;
  }

  private async record(operatorId: string, tripId: string, booking: Booking, outcome: 'BOARDED' | 'NO_SHOW'): Promise<BoardingRecord> {
    const existing = await this.repo.findOne({ where: { tripId, bookingId: booking.id } });
    const guard = canBoard(booking.status, !!existing);
    if (!guard.ok) throw new AppException(guard.code!, guard.message!, HttpStatus.BAD_REQUEST);
    return this.repo.save(this.repo.create({ operatorId, tripId, bookingId: booking.id, pnr: booking.pnr, outcome }));
  }

  /** Scans a QR payload, validates it, and marks the passenger boarded. */
  async scanAndBoard(operatorId: string, tripId: string, qrPayload: string): Promise<BoardingRecord> {
    const pnr = parseTicketToken(qrPayload);
    if (!pnr) throw new AppException('BOARDING_BAD_QR', 'The scanned code is not a valid ticket.', HttpStatus.BAD_REQUEST);
    const booking = await this.findBookingByPnr(operatorId, tripId, pnr);
    return this.record(operatorId, tripId, booking, 'BOARDED');
  }

  /** Manual boarding by PNR (when a scan is not possible). */
  async manualBoard(operatorId: string, tripId: string, pnr: string): Promise<BoardingRecord> {
    const booking = await this.findBookingByPnr(operatorId, tripId, pnr);
    return this.record(operatorId, tripId, booking, 'BOARDED');
  }

  async markNoShow(operatorId: string, tripId: string, pnr: string): Promise<BoardingRecord> {
    const booking = await this.findBookingByPnr(operatorId, tripId, pnr);
    return this.record(operatorId, tripId, booking, 'NO_SHOW');
  }
}
