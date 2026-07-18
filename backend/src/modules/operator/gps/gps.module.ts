import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GpsConfiguration, GpsDevice, GpsProvider, TrackingToken } from './entities/gps.entities';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Bus } from '../buses/entities/bus.entity';
import { GpsService } from './gps.service';
import { GpsController } from './gps.controller';
import { GpsProviderController } from './gps-provider.controller';
import { GpsTrackingController } from './gps-tracking.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GpsProvider, GpsConfiguration, GpsDevice, TrackingToken, Booking, Trip, Bus])],
  controllers: [GpsProviderController, GpsController, GpsTrackingController],
  providers: [GpsService],
  exports: [GpsService],
})
export class GpsModule {}
