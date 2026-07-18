import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { BookingsModule } from '../../booking/bookings/bookings.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../../integrations/email/email.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletRefundListener } from './wallet-refund.listener';

@Module({
  imports: [TypeOrmModule.forFeature([WalletTransaction]), BookingsModule, UsersModule, EmailModule],
  controllers: [WalletController],
  providers: [WalletService, WalletRefundListener],
  exports: [WalletService],
})
export class WalletModule {}
