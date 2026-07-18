import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedPassenger } from './entities/saved-passenger.entity';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SavedPassenger, Booking]), UsersModule, WalletModule, LoyaltyModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
