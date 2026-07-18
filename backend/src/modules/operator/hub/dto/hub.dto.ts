import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class CreateHubDto {
  @IsString() @MaxLength(120) name: string;
  @IsUUID() stopId: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
}
export class AttachRouteDto {
  @IsUUID() routeId: string;
}
