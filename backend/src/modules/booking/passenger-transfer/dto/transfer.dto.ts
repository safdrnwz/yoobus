import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class InitiateTransferDto {
  @IsUUID() bookingId: string;
  @IsUUID() toTripId: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
export class BulkTransferDto {
  @IsArray() @IsUUID('4', { each: true }) bookingIds: string[];
  @IsUUID() toTripId: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
