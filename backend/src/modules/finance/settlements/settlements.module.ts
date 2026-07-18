import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../customer/users/entities/user.entity';
import { EmailModule } from '../../integrations/email/email.module';
import { Settlement } from './entities/settlement.entity';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Refund } from '../payments/entities/refund.entity';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
@Module({
  imports: [EmailModule, TypeOrmModule.forFeature([Settlement, Booking, Refund, User])],
  controllers: [SettlementsController], providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
