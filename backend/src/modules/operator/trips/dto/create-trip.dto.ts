import { IsNumber, IsOptional, IsUUID, Matches, Min } from 'class-validator';
export class CreateTripDto {
  @IsUUID() routeId: string;
  @IsUUID() busId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }) departureDate: string;
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'time must be HH:mm' }) departureTime: string;
  @IsOptional() @IsNumber() @Min(0.1) fareMultiplier?: number;
}

export class AssignDriverDto {
  @IsUUID() driverId: string;
}
