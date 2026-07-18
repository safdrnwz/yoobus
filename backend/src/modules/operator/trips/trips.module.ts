import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Refund } from '../../finance/payments/entities/refund.entity';
import { User } from '../../customer/users/entities/user.entity';
import { EmailModule } from '../../integrations/email/email.module';
import { Trip } from './entities/trip.entity';
import { Bus } from '../buses/entities/bus.entity';
import { Route } from '../routes/entities/route.entity';
import { BookingSeat } from '../../booking/bookings/entities/booking-seat.entity';
import { SeatHold } from '../../booking/bookings/entities/seat-hold.entity';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
@Module({
  imports: [ConfigModule, EmailModule, TypeOrmModule.forFeature([Trip, Bus, Route, BookingSeat, SeatHold, Booking, Refund, User, Driver])],
  controllers: [TripsController], providers: [TripsService], exports: [TripsService],
})
export class TripsModule {}
