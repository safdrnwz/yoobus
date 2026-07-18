import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
export class RouteStopDto {
  @IsUUID() stopId: string;
  @IsInt() @Min(0) stopOrder: number;
  @IsNumber() @Min(0) fareFromOrigin: number;
  @IsOptional() @IsInt() @Min(0) arrivalOffsetMin?: number;
}
export class CreateRouteDto {
  @IsString() name: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => RouteStopDto)
  stops: RouteStopDto[];
}

/** Partial update. Replaces `@Body() patch: any`, which skipped validation completely. */
export class UpdateRouteDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => RouteStopDto)
  stops?: RouteStopDto[];
}
