import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { OtpModule } from './otp/otp.module';
import { TrackingModule } from './tracking/tracking.module';
import { WalletModule } from './wallet/wallet.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { ProfileModule } from './profile/profile.module';

/** Customer domain barrel — aggregates all customer feature modules. */
@Module({
  imports: [UsersModule, OtpModule, TrackingModule, WalletModule, LoyaltyModule, ProfileModule],
  exports: [UsersModule, OtpModule, TrackingModule, WalletModule, LoyaltyModule, ProfileModule],
})
export class CustomerModule {}
