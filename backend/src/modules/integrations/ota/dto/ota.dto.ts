import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OtaSearchDto {
  @IsUUID() fromStopId: string;
  @IsUUID() toStopId: string;
  @IsOptional() @IsString() date?: string;
}
export class OtaBlockDto {
  @IsUUID() tripId: string;
  @IsUUID() boardingStopId: string;
  @IsUUID() droppingStopId: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) seatNumbers: string[];
}
export class OtaPassengerDto {
  @IsString() seatNumber: string;
  @IsString() name: string;
  @IsOptional() age?: number;
  @IsOptional() @IsString() gender?: string;
}
export class OtaConfirmDto {
  @IsString() holdToken: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OtaPassengerDto) passengers: OtaPassengerDto[];
  @IsString() otaRef: string;                 // the OTA's own booking reference
  @IsOptional() @IsString() channelCode?: string; // e.g. REDBUS, ABHIBUS
}
export class OtaCancelDto { @IsString() pnr: string; }
