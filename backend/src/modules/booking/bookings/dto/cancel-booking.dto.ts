import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
export class CancelBookingDto {
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsBoolean() refundToWallet?: boolean;
}

export class PartialCancelDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) seatNumbers: string[];
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsBoolean() refundToWallet?: boolean;
}
