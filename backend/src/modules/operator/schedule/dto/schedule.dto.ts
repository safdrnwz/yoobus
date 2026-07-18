import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateScheduleDto {
  @IsString() @MaxLength(120) name: string;
  @IsString() routeId: string;
  @IsString() busId: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'departureTime must be HH:mm (24h).' }) departureTime: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) daysOfWeek: number[];
  @IsOptional() @IsIn(['WEEKLY', 'SEASONAL']) recurrence?: string;
  @IsOptional() @IsDateString() seasonStart?: string;
  @IsOptional() @IsDateString() seasonEnd?: string;
  @IsOptional() @IsNumber() @Min(0.1) @Max(10) fareMultiplier?: number;
}

export class GenerateTripsDto {
  @IsDateString() fromDate: string;
  @IsDateString() toDate: string;
}
