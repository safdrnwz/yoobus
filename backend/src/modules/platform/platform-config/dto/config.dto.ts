import { Allow, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const SETTING_NAMESPACE_VALUES = [
  'GENERAL', 'LOCALIZATION', 'SECURITY', 'BOOKING', 'PAYMENT',
  'NOTIFICATION', 'RETENTION', 'INTEGRATION', 'APPEARANCE',
] as const;

export class SetSettingDto {
  @IsIn(SETTING_NAMESPACE_VALUES as unknown as string[])
  namespace: string;
  @IsString() @MaxLength(60) key: string;
  // @Allow() stops the global ValidationPipe (whitelist + forbidNonWhitelisted) from
  // stripping and then rejecting this property. The real type check is validateSetting()
  // in the service, which knows the controlled schema for every namespace.key.
  @Allow() value: unknown;
}

/** One key/value pair inside a bulk save. */
export class SettingEntryDto {
  @IsString() @MaxLength(60) key: string;
  @Allow() value: unknown;
}

/**
 * Bulk save for a whole namespace — used by the Global Settings screen, which edits
 * many appearance keys at once and must persist them as ONE atomic, versioned change.
 */
export class BulkSetSettingsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => SettingEntryDto)
  settings: SettingEntryDto[];
}

export class UpsertFlagDto {
  @IsString() @MaxLength(60) key: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsBoolean() enabledGlobally?: boolean;
  @IsOptional() @IsString() scheduledAt?: string;
}

export class OperatorOverrideDto {
  @IsString() operatorId: string;
  @IsBoolean() enabled: boolean;
}
