import { Module } from '@nestjs/common';
import { DashboardModule } from './dashboard/dashboard.module';
import { CounterModule } from './counter/counter.module';
import { ScorecardModule } from './scorecard/scorecard.module';
import { RemindersModule } from './reminders/reminders.module';
import { DailyStatementModule } from './daily-statement/daily-statement.module';
import { TripsModule } from './trips/trips.module';
import { ForecastingModule } from './forecasting/forecasting.module';
import { DriverComplianceModule } from './driver-compliance/driver-compliance.module';
import { HubModule } from './hub/hub.module';
import { FinanceModule } from './finance/finance.module';
import { OperatorsModule } from './operators/operators.module';
import { BusesModule } from './buses/buses.module';
import { SeatLayoutsModule } from './seat-layouts/seat-layouts.module';
import { FuelModule } from './fuel/fuel.module';
import { DisruptionModule } from './disruption/disruption.module';
import { SupportCrmModule } from './support-crm/support-crm.module';
import { DriversModule } from './drivers/drivers.module';
import { OperatorScheduleModule } from './schedule/schedule.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { CrewHrModule } from './crew-hr/crew-hr.module';
import { FleetModule } from './fleet/fleet.module';
import { StopsModule } from './stops/stops.module';
import { RoutesModule } from './routes/routes.module';
import { GpsModule } from './gps/gps.module';

/** Operator domain barrel — aggregates all operator feature modules. */
@Module({
  imports: [SeatLayoutsModule, DashboardModule, CounterModule, ScorecardModule, RemindersModule, DailyStatementModule, TripsModule, ForecastingModule, DriverComplianceModule, HubModule, FinanceModule, OperatorsModule, BusesModule, FuelModule, DisruptionModule, SupportCrmModule, DriversModule, OperatorScheduleModule, MaintenanceModule, CrewHrModule, FleetModule, StopsModule, RoutesModule, GpsModule],
  exports: [SeatLayoutsModule, DailyStatementModule, TripsModule, ForecastingModule, DriverComplianceModule, HubModule, FinanceModule, OperatorsModule, BusesModule, FuelModule, DisruptionModule, SupportCrmModule, DriversModule, OperatorScheduleModule, MaintenanceModule, CrewHrModule, FleetModule, StopsModule, RoutesModule, GpsModule],
})
export class OperatorModule {}
