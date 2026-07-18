import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoicePayment } from './entities/invoice-payment.entity';
import { CreditNote } from './entities/credit-note.entity';
import { DebitNote } from './entities/debit-note.entity';
import { Operator } from '../../operator/operators/entities/operator.entity';
import { SaasBillingService } from './saas-billing.service';
import { SaasBillingController } from './saas-billing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoicePayment, CreditNote, DebitNote, Operator])],
  controllers: [SaasBillingController],
  providers: [SaasBillingService],
  exports: [SaasBillingService],
})
export class SaasBillingModule {}
