import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
export class PassengerDto {
  @IsString() seatNumber: string;
  // Provide a saved-passenger id to prefill details, or the fields directly.
  @IsOptional() @IsUUID() savedPassengerId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(120) age?: number;
  @IsOptional() @IsString() gender?: string;
}
export class CreateBookingDto {
  @IsUUID() holdToken: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PassengerDto) passengers: PassengerDto[];
  @IsOptional() @IsBoolean() optInsurance?: boolean;
  @IsOptional() @IsString() couponCode?: string;
  /** Link to your own booking on the same trip (approved-group exception, gender spec Case 5). */
  @IsOptional() @IsString() linkedPnr?: string;
}
