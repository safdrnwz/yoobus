import { Module } from '@nestjs/common';
import { SeatAlertModule } from './seat-alert/seat-alert.module';
import { SeatUpgradeModule } from './seat-upgrade/seat-upgrade.module';
import { ReviewsModule } from './reviews/reviews.module';
import { BoardingModule } from './boarding/boarding.module';
import { JourneySearchModule } from './journey-search/journey-search.module';
import { PassengerTransferModule } from './passenger-transfer/passenger-transfer.module';
import { BookingsModule } from './bookings/bookings.module';

/** Booking domain barrel — aggregates all booking feature modules. */
@Module({
  imports: [SeatAlertModule, SeatUpgradeModule, ReviewsModule, BoardingModule, JourneySearchModule, PassengerTransferModule, BookingsModule],
  exports: [SeatAlertModule, SeatUpgradeModule, ReviewsModule, BoardingModule, JourneySearchModule, PassengerTransferModule, BookingsModule],
})
export class BookingModule {}
