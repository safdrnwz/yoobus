import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '../../../../common/enums/role.enum';
export class CreateStaffDto {
  @IsString() @MinLength(3) fullName: string;
  @IsEmail() email: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @Matches(/^[0-9]{10}$/) phone?: string;
}

/**
 * Creating one of Yoo Bus's own staff. `role` is validated twice: the enum here, and
 * PLATFORM_CREATABLE_ROLES in the service — belt and braces on a privilege surface.
 */
export class CreatePlatformStaffDto {
  @IsString() @MinLength(3) fullName: string;
  @IsEmail() email: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @Matches(/^[0-9]{10}$/, { message: 'phone must be 10 digits' }) phone?: string;
}
