import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
export class ForgotPasswordDto { @IsEmail() email: string; }
export class ResetPasswordDto {
  @IsString() @MaxLength(200) token: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}
export class RefreshDto { @IsString() @MaxLength(200) refreshToken: string; }
export class LogoutDto { @IsString() @MaxLength(200) refreshToken: string; }

import { IsString as _IsString, MinLength as _MinLength } from 'class-validator';
export class SetPasswordDto {
  @_IsString() @_MinLength(8) newPassword: string;
}

export class ChangePasswordDto {
  @IsString() oldPassword: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}

export class ResendVerificationDto { @IsEmail() email: string; }

/* ------------------------------------------------------------------ *
 * These payloads used to be typed inline (`@Body() dto: { otp: string }`). Nest's
 * ValidationPipe skips inline object types entirely — the metatype is `Object` — so those
 * endpoints accepted ANY body, unvalidated. Real classes restore the guard.
 * ------------------------------------------------------------------ */

/** Verification accepts either an emailed link token, or email + OTP. */
export class VerifyEmailDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(4, 8) otp?: string;
  @IsOptional() @IsString() @MaxLength(120) token?: string;
}

export class ForgotPasswordOtpDto {
  /** Registered email, or the 10-digit mobile number. */
  @IsString() @MinLength(6) identifier: string;
}

export class ResetPasswordOtpDto {
  @IsString() @MinLength(6) identifier: string;
  @IsString() @Length(4, 8) otp: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}

export class ChangeEmailRequestDto {
  @IsEmail() newEmail: string;
}

export class ChangePhoneRequestDto {
  @IsString() @Matches(/^[0-9]{10}$/, { message: 'newPhone must be a 10-digit mobile number' }) newPhone: string;
}

export class ConfirmOtpDto {
  @IsString() @Length(4, 8) otp: string;
}
