import { IsOptional, IsUUID, Matches } from 'class-validator';
export class SearchTripDto {
  /** Optional: restrict the search to a single operator's trips. */
  @IsOptional() @IsUUID() operatorId?: string;
  @IsUUID() fromStopId: string;
  @IsUUID() toStopId: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}
