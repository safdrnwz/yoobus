import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../customer/users/users.module';
import { EmailModule } from '../../integrations/email/email.module';
import { UpgradeOffer } from './entities/upgrade-offer.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { SeatUpgradeService } from './seat-upgrade.service';
import { SeatUpgradeController } from './seat-upgrade.controller';

@Module({
  imports: [UsersModule, EmailModule, TypeOrmModule.forFeature([UpgradeOffer, Booking])],
  controllers: [SeatUpgradeController],
  providers: [SeatUpgradeService],
  exports: [SeatUpgradeService],
})
export class SeatUpgradeModule {}
