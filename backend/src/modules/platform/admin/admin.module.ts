import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { BusesModule } from '../../operator/buses/buses.module';
import { DriversModule } from '../../operator/drivers/drivers.module';
import { RoutesModule } from '../../operator/routes/routes.module';
import { TripsModule } from '../../operator/trips/trips.module';
import { BookingsModule } from '../../booking/bookings/bookings.module';
import { BillingModule } from '../../finance/billing/billing.module';
import { SettlementsModule } from '../../finance/settlements/settlements.module';
import { FinanceSummaryModule } from '../../finance/summary/summary.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Operator]),
    BusesModule,
    DriversModule,
    RoutesModule,
    TripsModule,
    BookingsModule,
    BillingModule,
    SettlementsModule,
    FinanceSummaryModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
