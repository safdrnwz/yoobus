import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { BusType } from '../../../../common/enums/bus-type.enum';
export class CreateBusDto {
  @IsString() registrationNumber: string;
  @IsString() name: string;
  @IsEnum(BusType) busType: BusType;
  @IsInt() @Min(1) totalSeats: number;
  // drag-and-drop layout (optional); na de to seatMap se simple layout
  @IsOptional() seatLayout?: any;
  @IsOptional() @IsArray() @ArrayMinSize(1) seatMap?: string[];
}

export class LadiesReservedDto {
  @IsArray() @IsString({ each: true }) seatNumbers: string[];
}

export class SeatAdjacencyDto {
  /** Pairs of seats that sit next to each other, e.g. [['1A','1B'], ['2A','2B']]. */
  @IsArray() @ArrayMinSize(1) pairs: [string, string][];
}

/**
 * `@Body() patch: any` bypassed the ValidationPipe entirely — PATCH /buses/:id accepted
 * literally any object, including keys that are not columns. A partial DTO keeps the same
 * flexibility while still checking every key that IS sent.
 */
export class UpdateBusDto {
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(BusType) busType?: BusType;
  @IsOptional() @IsInt() @Min(1) totalSeats?: number;
  @IsOptional() seatLayout?: unknown;
  @IsOptional() @IsArray() @ArrayMinSize(1) seatMap?: string[];
}

/**
 * One seat's price rule.
 *
 * An ARRAY, not a `Record<seatNumber, rule>` — class-validator cannot reach inside a record's
 * values (`@ValidateNested({ each: true })` validates the record's own properties instead,
 * so `{ "1": { multiplier: 1.2 } }` failed with "property 1 should not exist"). An array of
 * rules validates properly, seat by seat.
 */
export class SeatFareRuleDto {
  @IsString() seatNumber: string;
  /** Relative to the base segment fare. 1.15 = 15% dearer than a standard seat. */
  @IsNumber() @Min(0.25) @Max(5) multiplier: number;
  /** A flat premium added after the multiplier, for operators who price berths that way. */
  @IsOptional() @IsNumber() @Min(-100000) @Max(100000) delta?: number;
}

/** Set exact price rules. Seats not mentioned keep what they had. */
export class SetSeatFaresDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => SeatFareRuleDto)
  fares: SeatFareRuleDto[];
}

/**
 * Move prices in bulk.
 *
 * `percent` is a CHANGE (+5 = 5% dearer than now), `setMultiplier` is a TARGET (exactly
 * this). Omit `seats` and the whole bus moves; name them and only those move.
 */
export class AdjustSeatFaresDto {
  @IsOptional() @IsNumber() @Min(-90) @Max(400) percent?: number;
  @IsOptional() @IsNumber() @Min(-100000) @Max(100000) delta?: number;
  @IsOptional() @IsNumber() @Min(0.25) @Max(5) setMultiplier?: number;
  /** Leave empty to move every seat on the bus. */
  @IsOptional() @IsArray() @IsString({ each: true }) seats?: string[];
}
