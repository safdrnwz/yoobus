import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripLocation } from './entities/trip-location.entity';
import { Stop } from '../../operator/stops/entities/stop.entity';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { TripsModule } from '../../operator/trips/trips.module';
@Module({
  imports: [TypeOrmModule.forFeature([TripLocation, Stop]), TripsModule],
  controllers: [TrackingController], providers: [TrackingService],
})
export class TrackingModule {}
