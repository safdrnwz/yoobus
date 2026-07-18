import { IsBoolean, IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
export class OfferUpgradeDto {
  @IsUUID() bookingId: string;
  @IsIn(['SEATER', 'SEMI_SLEEPER', 'SLEEPER']) fromCategory: string;
  @IsIn(['SEATER', 'SEMI_SLEEPER', 'SLEEPER']) toCategory: string;
  @IsNumber() @Min(0) fromPrice: number;
  @IsNumber() @Min(0) toPrice: number;
  @IsOptional() @IsBoolean() complimentary?: boolean;
}
