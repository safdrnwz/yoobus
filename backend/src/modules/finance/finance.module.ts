import { Module } from '@nestjs/common';
import { FinanceSummaryModule } from './summary/summary.module';
import { CouponsModule } from './coupons/coupons.module';
import { FareFreezeModule } from './fare-freeze/fare-freeze.module';
import { SettlementsModule } from './settlements/settlements.module';
import { BillingModule } from './billing/billing.module';
import { PaymentsModule } from './payments/payments.module';
import { PricingModule } from './pricing/pricing.module';

/** Finance domain barrel — aggregates all finance feature modules. */
@Module({
  imports: [FinanceSummaryModule, CouponsModule, FareFreezeModule, SettlementsModule, BillingModule, PaymentsModule, PricingModule],
  exports: [CouponsModule, FareFreezeModule, SettlementsModule, BillingModule, PaymentsModule, PricingModule],
})
export class FinanceDomainModule {}
