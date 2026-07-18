import { Allow, ArrayMinSize, IsArray, IsEmail, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class RegisterPartnerDto {
  @IsString() @MaxLength(120) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsUrl({ require_tld: false }) callbackUrl?: string;
  @IsOptional() @IsInt() @Min(1) rateLimitPerMinute?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) scopes?: string[];
}

export class GenerateKeyDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsArray() @IsString({ each: true }) scopes?: string[];
  @IsOptional() @IsInt() @Min(1) expiresInDays?: number;
}

export class RegisterWebhookDto {
  @IsUrl({ require_tld: false }) url: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) eventTypes: string[];
  @IsOptional() @IsInt() @Min(1) maxAttempts?: number;
}

export class TestWebhookDto {
  @IsString() event: string;
  @Allow() payload: unknown;
}

export class CreateVersionDto {
  @IsString() @MaxLength(20) version: string;
}
