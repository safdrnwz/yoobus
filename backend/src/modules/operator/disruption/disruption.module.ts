import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { User } from '../../customer/users/entities/user.entity';
import { EmailModule } from '../../integrations/email/email.module';
import { DisruptionEvent } from './entities/disruption-event.entity';
import { DisruptionService } from './disruption.service';
import { DisruptionController } from './disruption.controller';

@Module({
  imports: [EmailModule, TypeOrmModule.forFeature([DisruptionEvent, Booking, User])],
  controllers: [DisruptionController],
  providers: [DisruptionService],
  exports: [DisruptionService],
})
export class DisruptionModule {}
