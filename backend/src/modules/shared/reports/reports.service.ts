import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { AppException } from '../../../common/errors/app-exception';

@Injectable()
export class ReportsService {
  constructor(@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>) {}

  private round(n: number) { return Math.round(n * 100) / 100; }

  async revenue(operatorId: string) {
    const confirmed = await this.bookingRepo.find({ where: { operatorId, status: BookingStatus.CONFIRMED } });
    const cancelled = await this.bookingRepo.count({ where: { operatorId, status: BookingStatus.CANCELLED } });
    const seats = confirmed.reduce((s, b) => s + b.seats.length, 0);
    return {
      operatorId, confirmedBookings: confirmed.length, cancelledBookings: cancelled, seatsSold: seats,
      grossBaseFare: this.round(confirmed.reduce((s, b) => s + Number(b.baseFare), 0)),
      fareGstCollected: this.round(confirmed.reduce((s, b) => s + Number(b.fareGst), 0)),
      operatorNetPayout: this.round(confirmed.reduce((s, b) => s + Number(b.operatorNet), 0)),
      note: 'The payment gateway is currently mocked, so these figures reflect booked value. Please confirm all tax rates with a qualified chartered accountant.',
    };
  }

  // Passenger manifest for the conductor or driver, scoped to the operator.
  async manifest(operatorId: string, tripId: string) {
    const bookings = await this.bookingRepo.find({ where: { operatorId, tripId, status: BookingStatus.CONFIRMED } });
    const pax = bookings.flatMap((b) => b.seats.map((s) => ({
      pnr: b.pnr, seatNumber: s.seatNumber, name: s.passengerName, age: s.passengerAge, gender: s.passengerGender,
      boardingOrder: b.boardingStopOrder, droppingOrder: b.droppingStopOrder,
    })));
    return { tripId, totalPassengers: pax.length, passengers: pax.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)) };
  }

  // GST report — fare GST + commission GST (operator-scoped)
  async gstReport(operatorId: string) {
    const confirmed = await this.bookingRepo.find({ where: { operatorId, status: BookingStatus.CONFIRMED } });
    return {
      operatorId, bookings: confirmed.length,
      fareGstCollected: this.round(confirmed.reduce((s, b) => s + Number(b.fareGst), 0)),
      commissionGst: this.round(confirmed.reduce((s, b) => s + Number(b.commissionGst), 0)),
      tcs: this.round(confirmed.reduce((s, b) => s + Number(b.tcs), 0)),
      tds: this.round(confirmed.reduce((s, b) => s + Number(b.tds), 0)),
      disclaimer: 'GST, TCS, and TDS rates are configurable defaults. Please have them verified by a chartered accountant before filing.',
    };
  }
}
