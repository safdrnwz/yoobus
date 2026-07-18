import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { BusType } from '../../../../common/enums/bus-type.enum';
const OWNERSHIP_TYPES = ['OWNED', 'LEASED', 'ATTACHED', 'CONTRACTED'] as const;
const BUS_CATEGORIES = ['STANDARD', 'PREMIUM', 'LUXURY', 'EXECUTIVE'] as const;
export const BUS_STATUSES = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'RETIRED', 'BLOCKED'] as const;
const FUEL_TYPES = ['DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'OTHER'] as const;
const AC_TYPES = ['AC', 'NON_AC'] as const;

/** Vehicle details (Bus Master spec §4.B). All optional; stored on bus.vehicleDetails. */
export class VehicleDetailsDto {
  @IsOptional() @IsString() manufacturer?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsInt() @Min(1980) @Max(2100) modelYear?: number;
  @IsOptional() @IsString() chassisNumber?: string;
  @IsOptional() @IsString() engineNumber?: string;
  @IsOptional() @IsString() vehicleType?: string;
  @IsOptional() @IsIn(FUEL_TYPES as unknown as string[]) fuelType?: string;
  @IsOptional() @IsIn(AC_TYPES as unknown as string[]) acType?: string;
  @IsOptional() @IsString() vehicleColor?: string;
  @IsOptional() @IsInt() @Min(1) totalVehicleCapacity?: number;
  @IsOptional() @IsNumber() @Min(0) vehicleLength?: number;
  @IsOptional() @IsNumber() @Min(0) vehicleWidth?: number;
  @IsOptional() @IsNumber() @Min(0) vehicleHeight?: number;
  @IsOptional() @IsNumber() @Min(0) grossVehicleWeight?: number;
  @IsOptional() @IsNumber() @Min(0) tareWeight?: number;
}

export class CreateBusDto {
  @IsString() registrationNumber: string;
  @IsString() name: string;
  @IsEnum(BusType) busType: BusType;
  @IsInt() @Min(1) totalSeats: number;
  // drag-and-drop layout (optional); na de to seatMap se simple layout
  @IsOptional() seatLayout?: any;
  @IsOptional() @IsArray() @ArrayMinSize(1) seatMap?: string[];

  // ── Bus Master spec fields (§3.A / §4.B) — all optional, backward compatible.
  @IsOptional() @IsString() fleetNumber?: string;
  @IsOptional() @IsIn(OWNERSHIP_TYPES as unknown as string[]) ownershipType?: string;
  @IsOptional() @IsIn(BUS_CATEGORIES as unknown as string[]) busCategory?: string;
  @IsOptional() @IsString() registrationDate?: string;
  @IsOptional() @ValidateNested() @Type(() => VehicleDetailsDto) vehicleDetails?: VehicleDetailsDto;
}

/** PATCH /buses/:id/status — lifecycle transition (spec §16.4). */
export class ChangeBusStatusDto {
  @IsIn(BUS_STATUSES as unknown as string[]) status: string;
}

/** PUT /buses/:id/amenities — replaces the amenity set (spec §7.E). */
export class SetAmenitiesDto {
  @IsArray() @IsString({ each: true }) amenities: string[];
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
  @IsOptional() @IsString() fleetNumber?: string;
  @IsOptional() @IsIn(OWNERSHIP_TYPES as unknown as string[]) ownershipType?: string;
  @IsOptional() @IsIn(BUS_CATEGORIES as unknown as string[]) busCategory?: string;
  @IsOptional() @IsString() registrationDate?: string;
  @IsOptional() @ValidateNested() @Type(() => VehicleDetailsDto) vehicleDetails?: VehicleDetailsDto;
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
