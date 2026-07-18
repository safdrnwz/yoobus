import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SUPPORTED_GPS_PROVIDERS } from '../gps.providers';

export class SetProviderStatusDto {
  @IsIn(SUPPORTED_GPS_PROVIDERS) providerName: string;
  @IsBoolean() enabled: boolean;
}

export class SaveGpsConfigDto {
  @IsIn(SUPPORTED_GPS_PROVIDERS) provider: string;
  @IsString() @MinLength(3) @MaxLength(300) apiBaseUrl: string;
  @IsString() @MinLength(1) @MaxLength(300) apiKey: string;
  @IsOptional() @IsString() @MaxLength(300) apiSecret?: string;
  @IsOptional() @IsString() @MaxLength(120) clientId?: string;
  @IsOptional() @IsString() @MaxLength(500) accessToken?: string;
  @IsOptional() @IsString() @MaxLength(300) webhookUrl?: string;
}

export class MapDeviceDto {
  @Matches(/^[0-9a-fA-F-]{36}$/, { message: 'busId must be a UUID' }) busId: string;
  @IsString() @MinLength(5) @MaxLength(40) imei: string;
  @IsOptional() @IsString() @MaxLength(80) deviceId?: string;
}
