import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatAvailabilityWatch } from './entities/seat-availability-watch.entity';
import { TripsModule } from '../../operator/trips/trips.module';
import { EmailModule } from '../../integrations/email/email.module';
import { MessagingModule } from '../../integrations/messaging/messaging.module';
import { SeatAlertService } from './seat-alert.service';
import { SeatAlertController } from './seat-alert.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SeatAvailabilityWatch]), TripsModule, EmailModule, MessagingModule],
  controllers: [SeatAlertController],
  providers: [SeatAlertService],
  exports: [SeatAlertService],
})
export class SeatAlertModule {}
