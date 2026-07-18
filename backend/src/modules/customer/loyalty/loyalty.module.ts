import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsTransaction, ReferralCode, ReferralRedemption } from './entities/loyalty.entities';
import { WalletModule } from '../wallet/wallet.module';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyListener } from './loyalty.listener';

@Module({
  imports: [TypeOrmModule.forFeature([ReferralCode, ReferralRedemption, PointsTransaction]), WalletModule, ConfigModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService, LoyaltyListener],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
