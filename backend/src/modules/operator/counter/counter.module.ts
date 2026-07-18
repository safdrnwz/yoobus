import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent, Counter, CounterSale } from './entities/counter.entities';
import { BookingsModule } from '../../booking/bookings/bookings.module';
import { CounterService } from './counter.service';
import { CounterController } from './counter.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Counter, Agent, CounterSale]), BookingsModule],
  controllers: [CounterController],
  providers: [CounterService],
  exports: [CounterService],
})
export class CounterModule {}
