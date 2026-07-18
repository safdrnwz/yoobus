import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class DeclareDisruptionDto {
  @IsIn(['BREAKDOWN', 'ACCIDENT', 'WEATHER', 'STRIKE', 'OTHER']) type: string;
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) severity: string;
  @IsString() @MaxLength(500) description: string;
  @IsOptional() @IsUUID() tripId?: string;
}
export class DivertDto {
  @IsUUID() divertedToRouteId: string;
}
export class BackupDto {
  @IsUUID() backupBusId: string;
}
export class RcaDto {
  @IsString() @MaxLength(1000) rootCause: string;
}
