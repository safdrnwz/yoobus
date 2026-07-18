import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingSeat } from '../../booking/bookings/entities/booking-seat.entity';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { TripsModule } from '../../operator/trips/trips.module';

@Module({
  imports: [TypeOrmModule.forFeature([BookingSeat]), TripsModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
