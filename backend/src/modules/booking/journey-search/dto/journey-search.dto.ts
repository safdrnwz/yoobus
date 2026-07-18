import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class JourneySearchDto {
  /** Optional: restrict the search to a single operator's trips. */
  @IsOptional() @IsUUID() operatorId?: string;
  @IsUUID() fromStopId: string;
  @IsUUID() toStopId: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(240) minLayover?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(30) @Max(720) maxLayover?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2) maxConnections?: number;
}
