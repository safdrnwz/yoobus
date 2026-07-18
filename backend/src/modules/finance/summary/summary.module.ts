import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Refund } from '../payments/entities/refund.entity';
import { Settlement } from '../settlements/entities/settlement.entity';
import { SetupInvoice } from '../billing/entities/setup-invoice.entity';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { MessagingUsage } from '../../integrations/messaging/entities/messaging-usage.entity';
import { EmailLog } from '../../integrations/email/email-log.entity';
import { FinanceSummaryService } from './summary.service';
import { FinanceSummaryController } from './summary.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Payment, Refund, Settlement, SetupInvoice, Operator, MessagingUsage, EmailLog])],
  controllers: [FinanceSummaryController],
  providers: [FinanceSummaryService],
  exports: [FinanceSummaryService],
})
export class FinanceSummaryModule {}
