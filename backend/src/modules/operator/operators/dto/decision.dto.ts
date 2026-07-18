import { IsOptional, IsNumber, IsString, Max, Min } from 'class-validator';
export class ApproveDto {
  @IsOptional() @IsNumber() @Min(0) @Max(1) commissionRate?: number; // fraction, e.g. 0.09
  @IsOptional() @IsNumber() @Min(0) setupFeePerBus?: number;
  @IsOptional() @IsNumber() @Min(0) oneTimePlatformFee?: number;
  @IsOptional() @IsNumber() @Min(0) smsCharge?: number;
  @IsOptional() @IsNumber() @Min(0) whatsappCharge?: number;
  @IsOptional() @IsNumber() @Min(0) emailCharge?: number;
}
export class RejectDto { @IsString() reason: string; }
export class CommissionDto {
  @IsNumber() @Min(0) @Max(1) commissionRate: number;
}
