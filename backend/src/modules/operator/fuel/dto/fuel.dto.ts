import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class FuelTxnDto {
  @IsUUID() busId: string;
  @IsIn(['REFILL', 'ADJUSTMENT', 'THEFT', 'LOSS']) type: string;
  @IsNumber() @Min(0) litres: number;
  @IsOptional() @IsNumber() @Min(0) pricePerLitre?: number;
  @IsOptional() @IsNumber() @Min(0) odometerKm?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
export class FuelCardDto {
  @IsString() @MaxLength(40) cardNumber: string;
  @IsOptional() @IsUUID() busId?: string;
}
