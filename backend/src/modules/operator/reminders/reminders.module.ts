import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Route } from '../routes/entities/route.entity';
import { User } from '../../customer/users/entities/user.entity';
import { EmailModule } from '../../integrations/email/email.module';
import { RemindersScheduler } from './reminders.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Trip, User, Route]), EmailModule],
  providers: [RemindersScheduler],
})
export class RemindersModule {}
