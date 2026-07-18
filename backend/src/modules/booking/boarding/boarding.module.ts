import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardingRecord } from './entities/boarding-record.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BoardingService } from './boarding.service';
import { BoardingController } from './boarding.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BoardingRecord, Booking])],
  controllers: [BoardingController],
  providers: [BoardingService],
  exports: [BoardingService],
})
export class BoardingModule {}
