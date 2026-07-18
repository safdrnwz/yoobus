import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangeEmailRequestDto, ChangePasswordDto, ChangePhoneRequestDto, ConfirmOtpDto, ForgotPasswordDto, ForgotPasswordOtpDto, LogoutDto, RefreshDto, ResendVerificationDto, ResetPasswordDto, ResetPasswordOtpDto, SetPasswordDto, VerifyEmailDto } from './dto/auth-extra.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * STEP 1 - Registration.
   * Body: { fullName, email, phone, password, consentGiven? }
   * Validates email + phone uniqueness, then emails a 6-digit OTP.
   * Response: { ok: true, message, otpId }  (account NOT created yet)
   */
  @Public() @Post('register')
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  /**
   * STEP 2 - OTP verification -> account creation -> AUTO-LOGIN.
   * Body (primary): { email: string; otp: string }
   * Body (legacy):  { token: string }
   * Response: { accessToken, refreshToken, user }
   */
  @Public() @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    if (dto.email && dto.otp) return this.auth.verifyEmail(dto.otp, dto.email);
    if (dto.token) return this.auth.verifyEmail(dto.token);
    return { ok: false, message: 'Provide either { email, otp } or { token }' };
  }

  /**
   * Login for returning users.
   * Body: { identifier: string; password: string }
   * identifier = registered EMAIL ("user@example.com") OR 10-digit MOBILE ("9811122233").
   * Response: { accessToken, refreshToken, user }
   */
  @Public() @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  /** Current authenticated user's JWT claims. */
  @Get('me') me(@CurrentUser() user: JwtUser) { return user; }

  /** Rotate a refresh token into a new access + refresh pair. */
  @Public() @Post('refresh') refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  /** Logout this device (revoke one refresh token). */
  @Public() @Post('logout') logout(@Body() dto: LogoutDto) { return this.auth.logout(dto.refreshToken); }

  /** Logout everywhere (revoke ALL refresh tokens for this user). */
  @Post('logout-all') logoutAll(@CurrentUser() user: JwtUser) { return this.auth.logoutAll(user.id); }

  /** Set a password for the first time (after passwordless OTP login). */
  @Post('set-password') setPassword(@CurrentUser() user: JwtUser, @Body() dto: SetPasswordDto) { return this.auth.setPassword(user.id, dto.newPassword); }

  /** Change password (requires the current one). */
  @Post('change-password') changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(user.id, dto.oldPassword, dto.newPassword); }

  /** Request a password-reset email (forgotten password). */
  @Public() @Post('forgot-password') forgot(@Body() dto: ForgotPasswordDto) { return this.auth.requestPasswordReset(dto.email); }

  /** Complete the password reset using the emailed token. */
  @Public() @Post('reset-password') reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto.token, dto.newPassword); }

  /** OTP password reset STEP 1 — send an OTP to the account's email + mobile. Body: { identifier } (email or mobile). */
  @Public() @Post('forgot-password-otp') forgotOtp(@Body() dto: ForgotPasswordOtpDto) { return this.auth.requestPasswordResetOtp(dto.identifier); }

  /** OTP password reset STEP 2 — verify OTP + set the new password. Body: { identifier, otp, newPassword }. */
  @Public() @Post('reset-password-otp') resetOtp(@Body() dto: ResetPasswordOtpDto) { return this.auth.resetPasswordWithOtp(dto.identifier, dto.otp, dto.newPassword); }

  /** Email change STEP 1 — send an OTP to the NEW email. Body: { newEmail }. */
  @Post('change-email/request') requestEmailChange(@CurrentUser() u: JwtUser, @Body() dto: ChangeEmailRequestDto) { return this.auth.requestEmailChangeOtp(u.id, dto.newEmail); }

  /** Email change STEP 2 — verify OTP + apply. Body: { otp }. */
  @Post('change-email/confirm') confirmEmailChange(@CurrentUser() u: JwtUser, @Body() dto: ConfirmOtpDto) { return this.auth.confirmEmailChange(u.id, dto.otp); }

  /** Mobile change STEP 1 — send an OTP to the NEW mobile. Body: { newPhone }. */
  @Post('change-phone/request') requestPhoneChange(@CurrentUser() u: JwtUser, @Body() dto: ChangePhoneRequestDto) { return this.auth.requestPhoneChangeOtp(u.id, dto.newPhone); }

  /** Mobile change STEP 2 — verify OTP + apply. Body: { otp }. */
  @Post('change-phone/confirm') confirmPhoneChange(@CurrentUser() u: JwtUser, @Body() dto: ConfirmOtpDto) { return this.auth.confirmPhoneChange(u.id, dto.otp); }

  /** Resend the registration OTP if the previous one expired. */
  @Public() @Post('resend-verification') resend(@Body() dto: ResendVerificationDto) { return this.auth.resendVerification(dto.email); }
}
