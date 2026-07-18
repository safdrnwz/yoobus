import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class CreateCouponDto {
  @IsString() @MaxLength(40) code: string;
  @IsIn(['PERCENT', 'FLAT']) type: 'PERCENT' | 'FLAT';
  @IsNumber() @Min(0) value: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;
  @IsOptional() @IsNumber() @Min(0) minFare?: number;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class ValidateCouponDto {
  @IsString() @MaxLength(40) code: string;
  @IsNumber() @Min(0) fare: number;
}
