import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { SavedPassenger } from '../../customer/profile/entities/saved-passenger.entity';
import { BookingSeat } from './entities/booking-seat.entity';
import { SeatHold } from './entities/seat-hold.entity';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { User } from '../../customer/users/entities/user.entity';
import { CommissionLedger } from '../../finance/billing/entities/commission-ledger.entity';
import { Refund } from '../../finance/payments/entities/refund.entity';
import { Payment } from '../../finance/payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { Trip } from '../../operator/trips/entities/trip.entity';
import { BookingsService } from './bookings.service';
import { PdfService } from './pdf.service';
import { BookingsController } from './bookings.controller';
import { TripsModule } from '../../operator/trips/trips.module';
import { SeatAlertModule } from '../seat-alert/seat-alert.module';
import { FareFreezeModule } from '../../finance/fare-freeze/fare-freeze.module';
import { CouponsModule } from '../../finance/coupons/coupons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingSeat, SeatHold, Operator, User, CommissionLedger, Refund, SavedPassenger, Payment, Review, Trip]),
    TripsModule,
    SeatAlertModule,
    FareFreezeModule,
    CouponsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, PdfService],
  exports: [BookingsService],
})
export class BookingsModule {}
