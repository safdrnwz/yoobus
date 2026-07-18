import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

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
  @IsIn(['INSURANCE', 'PERMIT', 'POLLUTION']) docType: string;
  @IsString() @MaxLength(60) documentNumber: string;
  @IsDateString() expiresAt: string;
}
export class PartDto {
  @IsString() @MaxLength(80) partName: string;
  @IsInt() quantity: number;
}
