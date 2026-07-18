import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { BUS_DOC_TYPES } from '../../../../common/logic/bus-document.util';

export class CreateWorkOrderDto {
  @IsUUID() busId: string;
  @IsString() @MaxLength(120) title: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class CloseWorkOrderDto {
  @IsOptional() @IsNumber() @Min(0) cost?: number;
}
export class VehicleDocDto {
  @IsUUID() busId: string;
  @IsIn(BUS_DOC_TYPES as unknown as string[]) docType: string;
  @IsString() @MaxLength(60) documentNumber: string;
  /** Required only when the document type requires expiry (validated in the service). */
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsString() @MaxLength(160) issuingAuthority?: string;
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}

export class UpdateVehicleDocDto {
  @IsOptional() @IsString() @MaxLength(60) documentNumber?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsString() @MaxLength(160) issuingAuthority?: string;
  @IsOptional() @IsIn(['ACTIVE', 'EXPIRED', 'CANCELLED', 'REVOKED', 'PENDING']) documentStatus?: string;
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}

export class VerifyVehicleDocDto {
  @IsIn(['VERIFIED', 'REJECTED']) decision: string;
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}
export class PartDto {
  @IsString() @MaxLength(80) partName: string;
  @IsInt() quantity: number;
}
