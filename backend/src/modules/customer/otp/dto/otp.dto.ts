import { IsEmail, IsIn, IsOptional, IsString, Length, MinLength } from 'class-validator';
export class RequestOtpDto {
  @IsEmail() email: string;
  @IsIn(['REGISTER', 'LOGIN']) purpose: 'REGISTER' | 'LOGIN';
  @IsOptional() @IsString() @MinLength(3) fullName?: string; // Required only for the REGISTER flow.
  @IsOptional() @IsString() phone?: string;
}
export class VerifyOtpDto {
  @IsEmail() email: string;
  @IsString() @Length(6, 6) code: string;
}
