import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from '../../booking/reviews/entities/review.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { DisruptionEvent } from '../disruption/entities/disruption-event.entity';
import { Operator } from '../operators/entities/operator.entity';
import { ScorecardService } from './scorecard.service';
import { ScorecardController } from './scorecard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Trip, Booking, DisruptionEvent, Operator])],
  controllers: [ScorecardController],
  providers: [ScorecardService],
  exports: [ScorecardService],
})
export class ScorecardModule {}
