import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForecastRecord } from './entities/forecast-record.entity';
import { ForecastingService } from './forecasting.service';
import { ForecastingController } from './forecasting.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ForecastRecord])],
  controllers: [ForecastingController],
  providers: [ForecastingService],
  exports: [ForecastingService],
})
export class ForecastingModule {}
