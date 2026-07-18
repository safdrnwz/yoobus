import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class CreateTicketDto {
  @IsString() @MaxLength(150) subject: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class CreateComplaintDto {
  @IsString() @MaxLength(150) subject: string;
  @IsOptional() @IsUUID() customerUserId?: string;
}
export class LostFoundDto {
  @IsString() @MaxLength(200) itemDescription: string;
  @IsOptional() @IsUUID() tripId?: string;
}
export class BlacklistDto {
  @IsUUID() customerUserId: string;
  @IsBoolean() blacklisted: boolean;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
