import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * `from`/`to` used to arrive as raw, unvalidated @Query strings — calling the endpoint
 * without them handed `undefined` straight to the date maths and returned a 500.
 */
export class PeriodQueryDto {
  @IsDateString({}, { message: 'from must be an ISO date (YYYY-MM-DD)' }) from: string;
  @IsDateString({}, { message: 'to must be an ISO date (YYYY-MM-DD)' }) to: string;

  /** Platform staff must name the operator; operator staff may omit it. */
  @IsOptional() @IsUUID() operatorId?: string;
}
