import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';
export class CreateMaintenanceDto {
  @IsDateString() startAt: string;
  @IsDateString() endAt: string;
  @IsString() @MinLength(5) @MaxLength(300) message: string;
}
