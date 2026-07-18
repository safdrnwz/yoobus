import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Payment } from '../../finance/payments/entities/payment.entity';
import { Refund } from '../../finance/payments/entities/refund.entity';
import { Operator } from '../operators/entities/operator.entity';
import { User } from '../../customer/users/entities/user.entity';
import { EmailModule } from '../../integrations/email/email.module';
import { DailyStatementService } from './daily-statement.service';
import { DailyStatementScheduler } from './daily-statement.scheduler';
import { DailyStatementController } from './daily-statement.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Payment, Refund, Operator, User]), EmailModule],
  controllers: [DailyStatementController],
  providers: [DailyStatementService, DailyStatementScheduler],
  exports: [DailyStatementService],
})
export class DailyStatementModule {}
