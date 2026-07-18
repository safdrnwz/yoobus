import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
export class RegisterChannelDto {
  @IsString() code: string;
  @IsString() displayName: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) channelCommissionRate?: number;
}
