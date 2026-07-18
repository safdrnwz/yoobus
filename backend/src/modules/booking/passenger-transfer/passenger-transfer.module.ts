import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../customer/users/users.module';
import { EmailModule } from '../../integrations/email/email.module';
import { TransferRecord } from './entities/transfer-record.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PassengerTransferService } from './passenger-transfer.service';
import { PassengerTransferController } from './passenger-transfer.controller';

@Module({
  imports: [UsersModule, EmailModule, TypeOrmModule.forFeature([TransferRecord, Booking])],
  controllers: [PassengerTransferController],
  providers: [PassengerTransferService],
  exports: [PassengerTransferService],
})
export class PassengerTransferModule {}
