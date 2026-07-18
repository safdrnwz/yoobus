import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsObject, IsOptional, IsString, Matches, Min, MinLength, ValidateNested } from 'class-validator';

/** KYC + business details + document attachments, captured on the single apply form. */
export class KycDetailsDto {
  // GSTIN — optional, but when present must be a valid GSTIN (e.g. 07ABCDE1234F1Z5).
  @IsOptional() @IsString() @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, { message: 'gstin must be a valid GSTIN' })
  gstin?: string;

  // PAN — optional, but when present must be a valid PAN (e.g. ABCDE1234F).
  @IsOptional() @IsString() @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'pan must be a valid PAN' })
  pan?: string;

  @IsOptional() @IsString() @MinLength(2) legalName?: string;
  @IsOptional() @IsObject() address?: Record<string, any>;
  @IsOptional() @IsObject() bankDetails?: Record<string, any>;
  @IsOptional() @IsObject() documents?: Record<string, any>;
}

/**
 * The "Become an Operator" application. ONE form, no login: the applicant fills every detail
 * here — company, contact, and full KYC with document attachments. There is no separate KYC step.
 */
export class CreateLeadDto {
  @IsString() @MinLength(2) companyName: string;
  @IsString() @MinLength(2) contactName: string;
  @IsEmail() email: string;
  @Matches(/^[0-9]{10}$/, { message: 'mobile must be 10 digits' }) mobile: string;
  @IsInt() @Min(1) totalBuses: number;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() details?: string;
  // Full business details + document attachment URLs, submitted with the application.
  // @ValidateNested + @Type make class-validator actually validate the fields inside `kyc`.
  @IsOptional() @IsObject() @ValidateNested() @Type(() => KycDetailsDto)
  kyc?: KycDetailsDto;
}
