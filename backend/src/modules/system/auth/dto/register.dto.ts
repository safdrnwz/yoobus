import { IsBoolean, IsEmail, IsOptional, Matches, IsString, MinLength } from 'class-validator';
export class RegisterDto {
  @IsString() @MinLength(3) fullName: string;
  @IsEmail() email: string;
  @Matches(/^[0-9]{10}$/, { message: 'phone must be exactly 10 digits' }) phone: string;
  @MinLength(8, { message: 'password must be at least 8 characters' }) password: string;
  @IsOptional() @IsBoolean() consentGiven?: boolean; // DPDP consent
}
