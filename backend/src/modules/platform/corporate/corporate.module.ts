import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorporateAccount, CorporateEmployee } from './entities/corporate.entities';
import { Booking } from '../../booking/bookings/entities/booking.entity';
import { User } from '../../customer/users/entities/user.entity';
import { CorporateService } from './corporate.service';
import { CorporateController } from './corporate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CorporateAccount, CorporateEmployee, Booking, User])],
  controllers: [CorporateController],
  providers: [CorporateService],
  exports: [CorporateService],
})
export class CorporateModule {}
