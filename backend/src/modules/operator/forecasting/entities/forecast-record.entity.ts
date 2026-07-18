import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { DemandLevel } from '../../../../common/logic/forecasting.util';

/** A demand/occupancy/revenue forecast for a route on a future date. */
@Entity('forecast_records')
export class ForecastRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) operatorId: string;
  @Column({ type: 'uuid' }) routeId: string;
  @Column({ type: 'date' }) forecastDate: string;
  @Column({ type: 'numeric', precision: 4, scale: 3 }) predictedOccupancy: number; // 0..1
  @Column({ type: 'varchar', length: 6 }) demandLevel: DemandLevel;
  @Column({ type: 'jsonb' }) recommendation: { addExtraBus: boolean; raiseFare: boolean; lowerFare: boolean };
  @CreateDateColumn() createdAt: Date;
}
