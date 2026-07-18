import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../customer/users/entities/user.entity';
import { SupportTicket } from '../../operator/support-crm/entities/support.entities';
import { Settlement } from '../../finance/settlements/entities/settlement.entity';
import { ScorecardModule } from '../../operator/scorecard/scorecard.module';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Operator, User, SupportTicket, Settlement]), ScorecardModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
