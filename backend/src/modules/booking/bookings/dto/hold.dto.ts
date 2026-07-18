import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsUUID, IsString, ValidateNested } from 'class-validator';

/** Optional early gender info at seat-lock time (gender spec §19.3). */
export class HoldPassengerDto {
  @IsString() seatNumber: string;
  @IsString() gender: string;
}

export class HoldDto {
  @IsUUID() tripId: string;
  @IsUUID() boardingStopId: string;
  @IsUUID() droppingStopId: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) seatNumbers: string[];
  @IsOptional() @IsUUID() freezeToken?: string;
  /** If genders are already known at selection time, the hold fails fast on gender rules. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => HoldPassengerDto)
  passengers?: HoldPassengerDto[];
}
