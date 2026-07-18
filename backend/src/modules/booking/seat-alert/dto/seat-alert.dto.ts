import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class CreateSeatAlertDto {
  @IsUUID() boardingStopId: string;
  @IsUUID() droppingStopId: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}
