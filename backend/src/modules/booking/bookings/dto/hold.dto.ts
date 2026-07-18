import { ArrayMinSize, IsArray, IsOptional, IsUUID, IsString } from 'class-validator';
export class HoldDto {
  @IsUUID() tripId: string;
  @IsUUID() boardingStopId: string;
  @IsUUID() droppingStopId: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) seatNumbers: string[];
  @IsOptional() @IsUUID() freezeToken?: string;
}
