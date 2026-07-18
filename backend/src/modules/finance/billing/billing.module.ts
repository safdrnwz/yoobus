import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetupInvoice } from './entities/setup-invoice.entity';
import { CommissionLedger } from './entities/commission-ledger.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
@Module({
  imports: [TypeOrmModule.forFeature([SetupInvoice, CommissionLedger])],
  controllers: [BillingController], providers: [BillingService], exports: [BillingService],
})
export class BillingModule {}
