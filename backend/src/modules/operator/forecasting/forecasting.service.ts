import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForecastRecord } from './entities/forecast-record.entity';
import { CreateForecastDto } from './dto/forecast.dto';
import { demandLevel, recommendation } from '../../../common/logic/forecasting.util';

/** Operator demand forecasting with operational recommendations. */
@Injectable()
export class ForecastingService {
  constructor(
    @InjectRepository(ForecastRecord) private readonly repo: Repository<ForecastRecord>,
  ) {}

  create(operatorId: string, dto: CreateForecastDto): Promise<ForecastRecord> {
    const level = demandLevel(dto.predictedOccupancy);
    return this.repo.save(this.repo.create({
      operatorId, routeId: dto.routeId, forecastDate: dto.forecastDate,
      predictedOccupancy: dto.predictedOccupancy, demandLevel: level, recommendation: recommendation(level),
    }));
  }

  list(operatorId: string): Promise<ForecastRecord[]> {
    return this.repo.find({ where: { operatorId }, order: { forecastDate: 'DESC' } });
  }
}
