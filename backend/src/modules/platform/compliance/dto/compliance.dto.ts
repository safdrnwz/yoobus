import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDsrDto {
  @IsEmail() subjectEmail: string;
  @IsIn(['ACCESS', 'CORRECTION', 'DELETION']) type: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class RecordConsentDto {
  @IsEmail() subjectEmail: string;
  @IsString() @MaxLength(60) purpose: string;
  @IsBoolean() granted: boolean;
}

export class RotateKeyDto {
  @IsString() @MaxLength(60) keyAlias: string;
}
