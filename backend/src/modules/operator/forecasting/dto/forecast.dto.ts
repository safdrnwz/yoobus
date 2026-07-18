import { IsDateString, IsNumber, IsUUID, Max, Min } from 'class-validator';
export class CreateForecastDto {
  @IsUUID() routeId: string;
  @IsDateString() forecastDate: string;
  @IsNumber() @Min(0) @Max(1) predictedOccupancy: number;
}
