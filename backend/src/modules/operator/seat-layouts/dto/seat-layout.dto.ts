import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional,
  IsString, MaxLength, Min, ValidateNested,
} from 'class-validator';
import {
  BOOKABLE_KINDS, CANVAS_HEIGHT, CANVAS_WIDTH, ROTATIONS,
} from '../../../../common/logic/seat-layout.util';

const ITEM_KINDS = [
  ...BOOKABLE_KINDS,
  'DRIVER', 'CREW', 'ENTRANCE', 'EXIT', 'STAIR', 'TOILET', 'WHEEL_ARCH', 'PARTITION', 'EMPTY',
];

/** A seat's configurable properties — everything the operator can set by clicking it. */
export class SeatPropsDto {
  @IsOptional() @IsIn(['ANY', 'FEMALE_ONLY', 'MALE_ONLY']) gender?: string;
  @IsOptional() @IsIn(['PREMIUM', 'STANDARD', 'ECONOMY', 'LAST_ROW', 'LADIES', 'LUXURY']) fareZone?: string;
  @IsOptional() @IsBoolean() isWindow?: boolean;
  @IsOptional() @IsBoolean() isAisle?: boolean;
  @IsOptional() @IsBoolean() reserved?: boolean;
  @IsOptional() @IsBoolean() blocked?: boolean;
  @IsOptional() @IsBoolean() wheelchair?: boolean;
  @IsOptional() @IsString() @MaxLength(40) label?: string;
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}

/** One thing on the canvas: a seat, a door, the driver, a wheel arch. */
export class LayoutItemDto {
  @IsString() @IsNotEmpty() id: string;
  @IsIn(ITEM_KINDS) kind: string;

  // Bounds are checked against the canvas here AND again by validateLayout() before publish.
  // Twice, because this is the only place a malformed payload can be stopped at the door.
  @IsNumber() @Min(0) x: number;
  @IsNumber() @Min(0) y: number;
  @IsInt() @Min(1) w: number;
  @IsInt() @Min(1) h: number;

  @IsIn(ROTATIONS) rotation: number;

  /** Bookable items only. Uniqueness is enforced across the whole layout at publish. */
  @IsOptional() @IsString() @MaxLength(12) seatNumber?: string;

  @IsOptional() @ValidateNested() @Type(() => SeatPropsDto) props?: SeatPropsDto;
}

export class DeckDto {
  @IsIn(['LOWER', 'UPPER']) deck: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LayoutItemDto) items: LayoutItemDto[];
}

export class LayoutDefinitionDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => DeckDto) decks: DeckDto[];
}

export class CreateLayoutDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(40) busType?: string;
  @IsOptional() @ValidateNested() @Type(() => LayoutDefinitionDto) definition?: LayoutDefinitionDto;
}

export class UpdateLayoutDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) busType?: string;
  @IsOptional() @ValidateNested() @Type(() => LayoutDefinitionDto) definition?: LayoutDefinitionDto;
}

export class CloneLayoutDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  /**
   * false (default) — the next VERSION of the same layout: buses can be migrated to it.
   * true            — a brand new, unrelated layout that just happens to start from this one.
   */
  @IsOptional() @IsBoolean() asNewFamily?: boolean;
}

export class AssignLayoutDto {
  @IsString() @IsNotEmpty() templateId: string;
}

/** Echoed to the client so the builder never hardcodes the canvas it draws on. */
export const LAYOUT_CANVAS = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
