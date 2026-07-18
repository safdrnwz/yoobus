import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
export class AssignBusDto { @IsUUID() busId: string; }

/** Partial update. Replaces `@Body() patch: any`, which skipped validation completely. */
export class UpdateDriverDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @Matches(/^[0-9]{10}$/, { message: 'phone must be 10 digits' }) phone?: string;
  @IsOptional() @IsString() licenseNumber?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) licenseExpiry?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
