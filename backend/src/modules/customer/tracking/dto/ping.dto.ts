import { IsNumber, IsOptional, IsUUID } from 'class-validator';
export class PingDto {
  @IsUUID() tripId: string;
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
  @IsOptional() @IsNumber() speedKmph?: number;
}
