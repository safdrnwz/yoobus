import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bus } from '../buses/entities/bus.entity';
import { SeatLayoutTemplate } from './entities/seat-layout-template.entity';
import { SeatLayoutsController } from './seat-layouts.controller';
import { SeatLayoutsService } from './seat-layouts.service';

@Module({
  imports: [TypeOrmModule.forFeature([SeatLayoutTemplate, Bus])],
  controllers: [SeatLayoutsController],
  providers: [SeatLayoutsService],
  exports: [SeatLayoutsService],
})
export class SeatLayoutsModule {}
