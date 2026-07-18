import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  controllers: [ReportsController], providers: [ReportsService],
})
export class ReportsModule {}
