import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddDocumentDto {
  @IsUUID() driverId: string;
  @IsIn(['LICENSE', 'POLICE_VERIFICATION', 'MEDICAL']) docType: string;
  @IsString() @MaxLength(60) documentNumber: string;
  @IsDateString() expiresAt: string;
  @IsOptional() @IsString() @MaxLength(200) fileKey?: string;
}
export class ViolationDto {
  @IsUUID() driverId: string;
  @IsString() @MaxLength(60) type: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
export class TrainingDto {
  @IsUUID() driverId: string;
  @IsString() @MaxLength(100) program: string;
  @IsOptional() @IsDateString() completedAt?: string;
}
