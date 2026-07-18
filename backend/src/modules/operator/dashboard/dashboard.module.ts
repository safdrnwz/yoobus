import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from '../trips/entities/trip.entity';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Bus } from '../buses/entities/bus.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Settlement } from '../../finance/settlements/entities/settlement.entity';
import { SupportTicket } from '../support-crm/entities/support.entities';
import { DisruptionEvent } from '../disruption/entities/disruption-event.entity';
import { ScorecardModule } from '../scorecard/scorecard.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Booking, Bus, Driver, Settlement, SupportTicket, DisruptionEvent]),
    ScorecardModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
