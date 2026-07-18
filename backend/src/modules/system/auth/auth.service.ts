import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../../customer/users/users.service';
import { OtpService } from '../../customer/otp/otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { KnownDevice } from './entities/known-device.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { AuditService } from '../../platform/audit/audit.service';
import { afterFailure, afterSuccess, isLocked, lockRemainingSec } from '../../../common/logic/login-lockout.util';
import { AppException } from '../../../common/errors/app-exception';
import { EmailService } from '../../integrations/email/email.service';
import { refreshTokenUsable, validatePassword } from '../../../common/logic/auth-security.util';

const RESET_TTL_MIN = 30;
const REFRESH_TTL_DAYS = 30;

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly otpService: OtpService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    @InjectRepository(PasswordResetToken) private readonly resetRepo: Repository<PasswordResetToken>,
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(LoginAttempt) private readonly attemptRepo: Repository<LoginAttempt>,
    @InjectRepository(EmailVerificationToken) private readonly verifyRepo: Repository<EmailVerificationToken>,
    @InjectRepository(KnownDevice) private readonly deviceRepo: Repository<KnownDevice>,
    private readonly audit: AuditService,
  ) {}

  private async securityEvent(action: string, userId: string | null, meta?: Record<string, any>) {
    await this.audit.record({
      userId, role: meta?.role ?? null, operatorId: meta?.operatorId ?? null,
      method: 'AUTH', path: '/auth', statusCode: 200, action,
    });
  }

  /**
   * STEP 1 - Registration initiation.
   * Validates uniqueness of email + phone, stores the pending profile (with the
   * hashed password) in an OTP row, and sends a 6-digit OTP to the user's email
   * (and SMS when a phone number is provided).
   * NO account is created yet - that happens in verifyEmail() after OTP confirmation.
   */
  async register(dto: RegisterDto) {
    // Validate password strength up front.
    const pwCheck = validatePassword(dto.password);
    if (!pwCheck.ok) throw new AppException(pwCheck.code!, pwCheck.message!, HttpStatus.BAD_REQUEST);

    // Email must be new.
    const existingByEmail = await this.users.findPassengerByEmail(dto.email);
    if (existingByEmail) throw new AppException('EMAIL_TAKEN', 'This email is already registered. Please log in instead.', HttpStatus.CONFLICT);

    // Phone must be new.
    if (dto.phone) {
      const existingByPhone = await this.users.findByPhoneForLogin(dto.phone);
      if (existingByPhone) throw new AppException('PHONE_TAKEN', 'This mobile number is already registered. Please log in instead.', HttpStatus.CONFLICT);
    }

    // Hash the password once here; verifyEmail() stores this hash directly.
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.otpService.request({
      email: dto.email,
      purpose: 'REGISTER',
      fullName: dto.fullName,
      phone: dto.phone,
      pendingPassword: passwordHash,
      consentGiven: dto.consentGiven,
    });

    return {
      ok: true,
      message: `A 6-digit OTP has been sent to ${dto.email}. Enter it to complete your registration.`,
      otpId: result.otpId,
      // devOtp is present only when EMAIL_DEV_MODE is on and NODE_ENV != production.
      ...(('devOtp' in result) ? { devOtp: (result as any).devOtp } : {}),
    };
  }

  /** Issues a fresh verification token and emails it. */
  private async sendVerification(user: { id: string; email: string; fullName: string }) {
    const raw = randomBytes(24).toString('hex');
    await this.verifyRepo.save(this.verifyRepo.create({
      userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }));
    await this.email.send({ to: user.email, template: 'EMAIL_VERIFY', vars: { name: user.fullName, verifyUrl: `https://app.yoobus.com/verify?token=${raw}` }, operatorId: null });
  }

  /**
   * STEP 2 - OTP verification + account creation + auto-login.
   * Called with (otpCode, email) from POST /auth/verify-email { email, otp }.
   * Creates the account using the password hash captured at registration,
   * marks the email verified, and returns a full session (access + refresh tokens).
   * The single-argument form remains as the legacy link-token path.
   */
  async verifyEmail(rawToken: string, emailForOtp?: string) {
    // New OTP-based path: rawToken is the 6-digit OTP, emailForOtp identifies the registration.
    if (emailForOtp) {
      const { user } = await this.otpService.verifyForRegistration(emailForOtp, rawToken);
      await this.securityEvent('EMAIL_VERIFIED', user.id);
      return this.issueSession(user);
    }

    // Legacy link-token path (kept for backward compatibility with old deep links).
    const record = await this.verifyRepo.findOne({ where: { tokenHash: sha256(rawToken) } });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new AppException('VERIFICATION_INVALID', 'This verification link is invalid or has expired.', HttpStatus.BAD_REQUEST);
    }
    await this.users.markEmailVerified(record.userId);
    record.usedAt = new Date();
    await this.verifyRepo.save(record);
    await this.securityEvent('EMAIL_VERIFIED', record.userId);
    return { ok: true, message: 'Your email has been verified.' };
  }

  /** Resends the registration OTP (leak-safe: always returns the same message). */
  async resendVerification(email: string) {
    // Whether the account exists-but-unverified, or the OTP simply expired before
    // the account was created, a fresh REGISTER OTP handles both cases.
    await this.otpService.request({ email, purpose: 'REGISTER' }).catch(() => { /* enumeration-safe */ });
    return { ok: true, message: 'If that email is awaiting verification, a new OTP has been sent.' };
  }

  /**
   * Login with EMAIL or 10-digit MOBILE NUMBER + password.
   * dto.identifier: "user@example.com" or "9811122233".
   */
  async login(dto: LoginDto, ctx?: { ip?: string; userAgent?: string }) {
    const maxAttempts = this.config.get<number>('app.loginMaxAttempts') ?? 5;
    const lockMinutes = this.config.get<number>('app.loginLockMinutes') ?? 15;
    const now = Date.now();
    const identifier = dto.identifier.trim();
    const attempt = await this.attemptRepo.findOne({ where: { email: identifier } });
    const lockedUntilMs = attempt?.lockedUntil ? attempt.lockedUntil.getTime() : null;
    if (isLocked(lockedUntilMs, now)) {
      const secs = lockRemainingSec(lockedUntilMs, now);
      throw new AppException('ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${Math.ceil(secs / 60)} minute(s).`, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Resolve the user by mobile number (exactly 10 digits) or by email.
    const isMobile = /^[0-9]{10}$/.test(identifier);
    const user = isMobile
      ? await this.users.findByPhoneForLogin(identifier)
      : await this.users.findAnyByEmailForLogin(identifier);

    const ok = user && user.isActive && (await bcrypt.compare(dto.password, user.password));
    if (!ok) {
      const next = afterFailure({ failedCount: attempt?.failedCount ?? 0, lockedUntilMs }, now, maxAttempts, lockMinutes);
      await this.attemptRepo.save(this.attemptRepo.create({
        id: attempt?.id, email: identifier, failedCount: next.failedCount,
        lockedUntil: next.lockedUntilMs ? new Date(next.lockedUntilMs) : null,
      }));
      await this.securityEvent('LOGIN_FAILED', user?.id ?? null);
      if (next.lockedUntilMs) throw new AppException('ACCOUNT_LOCKED', 'Too many failed attempts. Your account is temporarily locked.', HttpStatus.TOO_MANY_REQUESTS);
      throw new AppException('INVALID_CREDENTIALS', 'Invalid email/mobile or password.', HttpStatus.UNAUTHORIZED);
    }
    // Success - reset the lockout counter.
    if (attempt) { const s = afterSuccess(); attempt.failedCount = s.failedCount; attempt.lockedUntil = null; await this.attemptRepo.save(attempt); }
    await this.securityEvent('LOGIN_SUCCESS', user.id, { role: user.role, operatorId: user.operatorId });
    await this.checkNewDevice(user, ctx);
    return this.issueSession(user);
  }

  /** Alerts the user by email when they sign in from a device we haven't seen before. */
  private async checkNewDevice(user: { id: string; email: string; fullName: string }, ctx?: { ip?: string; userAgent?: string }) {
    try {
      const ua = (ctx?.userAgent ?? '').slice(0, 300);
      const ip = (ctx?.ip ?? '').slice(0, 60);
      const fingerprint = sha256(`${ua}|${ip}`);
      const existing = await this.deviceRepo.findOne({ where: { userId: user.id, fingerprint } });
      if (existing) { existing.lastSeenAt = new Date(); await this.deviceRepo.save(existing); return; }
      await this.deviceRepo.save(this.deviceRepo.create({ userId: user.id, fingerprint, userAgent: ua || null, ip: ip || null }));
      // Don't alert on the very first device (registration/first login).
      const count = await this.deviceRepo.count({ where: { userId: user.id } });
      if (count > 1) {
        await this.email.send({ to: user.email, template: 'NEW_DEVICE_LOGIN', vars: { name: user.fullName, device: ua || 'Unknown', ip: ip || 'Unknown', time: new Date().toISOString() }, operatorId: null });
      }
    } catch { /* device alert must never block login */ }
  }

  // ---- Password reset ----
  /** Always returns ok (does not leak whether the email exists). Emails a reset link when it does. */
  async requestPasswordReset(email: string) {
    const user = await this.users.findAnyByEmailForLogin(email);
    if (user) {
      const raw = randomBytes(32).toString('hex');
      await this.resetRepo.save(this.resetRepo.create({
        userId: user.id, tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60 * 1000),
      }));
      await this.email.send({ to: user.email, template: 'PASSWORD_RESET', vars: { fullName: user.fullName, resetToken: raw, expiryMinutes: RESET_TTL_MIN }, operatorId: null });
    }
    return { ok: true, message: 'If that email is registered, a reset link has been sent.' };
  }

  /**
   * OTP-based password reset — STEP 1.
   * Accepts an EMAIL or 10-digit MOBILE. Sends a 6-digit OTP to the account's
   * email and/or phone. Enumeration-safe (always returns the same message).
   */
  async requestPasswordResetOtp(identifier: string) {
    const id = identifier.trim();
    const isMobile = /^[0-9]{10}$/.test(id);
    const user = isMobile
      ? await this.users.findByPhoneForLogin(id)
      : await this.users.findAnyByEmailForLogin(id);
    if (user) {
      await this.otpService.requestOtp({
        purpose: 'PASSWORD_RESET',
        keyEmail: user.email,                 // OTP row keyed on the account email
        channelEmail: user.email,             // deliver to email
        channelPhone: user.phone ?? undefined, // and to phone if present
        payload: { userId: user.id },
      }).catch(() => {});
    }
    return { ok: true, message: 'If that account exists, an OTP has been sent to the registered email and mobile.' };
  }

  /**
   * OTP-based password reset — STEP 2.
   * Verifies the OTP (looked up via the account's email) and sets the new password.
   * `identifier` may be email or mobile; we resolve it to the account email first.
   */
  async resetPasswordWithOtp(identifier: string, otp: string, newPassword: string) {
    const policy = validatePassword(newPassword);
    if (!policy.ok) throw new AppException(policy.code!, policy.message!, HttpStatus.BAD_REQUEST);
    const id = identifier.trim();
    const isMobile = /^[0-9]{10}$/.test(id);
    const user = isMobile
      ? await this.users.findByPhoneForLogin(id)
      : await this.users.findAnyByEmailForLogin(id);
    if (!user) throw new AppException('INVALID_CREDENTIALS', 'Invalid account or OTP.', HttpStatus.BAD_REQUEST);

    await this.otpService.verifyPurpose(user.email, 'PASSWORD_RESET', otp);

    const hash = await bcrypt.hash(newPassword, 10);
    await this.users.updatePassword(user.id, hash);
    // Revoke every active session for safety.
    await this.refreshRepo.update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.email.send({ to: user.email, template: 'PASSWORD_CHANGED', vars: { fullName: user.fullName }, operatorId: null }).catch(() => {});
    await this.securityEvent('PASSWORD_RESET', user.id);
    return { ok: true, message: 'Your password has been reset. Please sign in.' };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const policy = validatePassword(newPassword);
    if (!policy.ok) throw new AppException(policy.code!, policy.message!, HttpStatus.BAD_REQUEST);
    const record = await this.resetRepo.findOne({ where: { tokenHash: sha256(rawToken) } });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new AppException('RESET_TOKEN_INVALID', 'This reset link is invalid or has expired.', HttpStatus.BAD_REQUEST);
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.users.updatePassword(record.userId, hash);
    record.usedAt = new Date();
    await this.resetRepo.save(record);
    // Revoke every active session for safety.
    await this.refreshRepo.update({ userId: record.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    const user = await this.users.findById(record.userId);
    if (user) await this.email.send({ to: user.email, template: 'PASSWORD_CHANGED', vars: { fullName: user.fullName }, operatorId: null });
    await this.securityEvent('PASSWORD_RESET', record.userId);
    return { ok: true, message: 'Your password has been reset. Please sign in.' };
  }

  /** Sets the user's own password after OTP verification (first-time setup or change). */
  async setPassword(userId: string, newPassword: string) {
    const policy = validatePassword(newPassword);
    if (!policy.ok) throw new AppException(policy.code!, policy.message!, HttpStatus.BAD_REQUEST);
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('USER_NOT_FOUND', 'Account not found.', HttpStatus.NOT_FOUND);
    const hash = await bcrypt.hash(newPassword, 10);
    await this.users.updatePassword(userId, hash);
    await this.email.send({ to: user.email, template: 'PASSWORD_CHANGED', vars: { fullName: user.fullName }, operatorId: null });
    await this.securityEvent('PASSWORD_SET', userId);
    return { ok: true, message: 'Your password has been set. You can now sign in with your email and password.' };
  }

  // ---- Refresh token rotation ----
  async refresh(rawRefresh: string) {
    const record = await this.refreshRepo.findOne({ where: { tokenHash: sha256(rawRefresh) } });
    if (!record) throw new AppException('REFRESH_INVALID', 'Invalid session. Please sign in again.', HttpStatus.UNAUTHORIZED);
    const usable = refreshTokenUsable(record.expiresAt.getTime(), Date.now(), !!record.revokedAt);
    if (!usable.ok) throw new AppException(usable.code!, usable.message!, HttpStatus.UNAUTHORIZED);
    const user = await this.users.findById(record.userId);
    if (!user || !user.isActive) throw new AppException('ACCOUNT_INACTIVE', 'Account is inactive', HttpStatus.UNAUTHORIZED);
    // Rotate: revoke current, issue a fresh pair.
    const next = await this.issueSession(user);
    record.revokedAt = new Date();
    await this.refreshRepo.save(record);
    return next;
  }

  async logout(rawRefresh: string) {
    const record = await this.refreshRepo.findOne({ where: { tokenHash: sha256(rawRefresh) } });
    if (record && !record.revokedAt) { record.revokedAt = new Date(); await this.refreshRepo.save(record); }
    return { ok: true };
  }

  /** Revoke every active session for this user (logout from all devices). */
  async logoutAll(userId: string) {
    const res = await this.refreshRepo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.securityEvent('LOGOUT_ALL', userId);
    return { ok: true, sessionsRevoked: res.affected ?? 0 };
  }

  /** Change password for a logged-in user: verify the current password, then set the new one. */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user) throw new AppException('USER_NOT_FOUND', 'Account not found.', HttpStatus.NOT_FOUND);
    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) throw new AppException('INVALID_CURRENT_PASSWORD', 'Your current password is incorrect.', HttpStatus.BAD_REQUEST);
    const policy = validatePassword(newPassword);
    if (!policy.ok) throw new AppException(policy.code!, policy.message!, HttpStatus.BAD_REQUEST);
    const hash = await bcrypt.hash(newPassword, 10);
    await this.users.updatePassword(userId, hash);
    // Sign out other sessions for safety.
    await this.refreshRepo.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.email.send({ to: user.email, template: 'PASSWORD_CHANGED', vars: { fullName: user.fullName }, operatorId: null });
    await this.securityEvent('PASSWORD_CHANGED', userId);
    return { ok: true, message: 'Your password has been changed. Please sign in again on other devices.' };
  }

  // ==================== EMAIL / MOBILE MANAGEMENT (with OTP verification) ====================
  // Requirement 3 — update email/mobile after login, verify ownership by OTP,
  // prevent duplicates, and support identity-linking (add the missing credential).

  /** STEP 1 — request an OTP to the NEW email the user wants to claim. */
  async requestEmailChangeOtp(userId: string, newEmail: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('USER_NOT_FOUND', 'Account not found.', HttpStatus.NOT_FOUND);
    // Reject if the new email is already used by someone else.
    await this.users.assertEmailAvailable(newEmail, userId);
    await this.otpService.requestOtp({
      purpose: 'UPDATE_EMAIL',
      keyEmail: `update-email:${userId}`,   // namespaced key so it never collides with REGISTER/LOGIN rows
      channelEmail: newEmail,               // deliver the OTP to the NEW email to prove ownership
      payload: { userId, newEmail },
    });
    return { ok: true, message: `An OTP has been sent to ${newEmail}. Enter it to confirm the change.` };
  }

  /** STEP 2 — verify the OTP and apply the email change. */
  async confirmEmailChange(userId: string, otp: string) {
    const { payload } = await this.otpService.verifyPurpose(`update-email:${userId}`, 'UPDATE_EMAIL', otp);
    if (!payload?.newEmail || payload.userId !== userId) throw new AppException('OTP_INVALID', 'Invalid OTP session.', HttpStatus.BAD_REQUEST);
    const updated = await this.users.applyEmailChange(userId, payload.newEmail);
    await this.securityEvent('EMAIL_CHANGED', userId, { newEmail: payload.newEmail });
    return { ok: true, message: 'Your email has been updated and verified.', email: updated.email };
  }

  /** STEP 1 — request an OTP to the NEW mobile the user wants to claim. */
  async requestPhoneChangeOtp(userId: string, newPhone: string) {
    if (!/^[0-9]{10}$/.test(newPhone)) throw new AppException('INVALID_PHONE', 'Mobile number must be exactly 10 digits.', HttpStatus.BAD_REQUEST);
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('USER_NOT_FOUND', 'Account not found.', HttpStatus.NOT_FOUND);
    await this.users.assertPhoneAvailable(newPhone, userId);
    await this.otpService.requestOtp({
      purpose: 'UPDATE_PHONE',
      keyEmail: `update-phone:${userId}`,
      channelPhone: newPhone,               // deliver the OTP to the NEW mobile to prove ownership
      payload: { userId, newPhone },
    });
    return { ok: true, message: `An OTP has been sent to ${newPhone}. Enter it to confirm the change.` };
  }

  /** STEP 2 — verify the OTP and apply the mobile change. */
  async confirmPhoneChange(userId: string, otp: string) {
    const { payload } = await this.otpService.verifyPurpose(`update-phone:${userId}`, 'UPDATE_PHONE', otp);
    if (!payload?.newPhone || payload.userId !== userId) throw new AppException('OTP_INVALID', 'Invalid OTP session.', HttpStatus.BAD_REQUEST);
    const updated = await this.users.applyPhoneChange(userId, payload.newPhone);
    await this.securityEvent('PHONE_CHANGED', userId, { newPhone: payload.newPhone });
    return { ok: true, message: 'Your mobile number has been updated and verified.', phone: updated.phone };
  }

  /** Mints a short-lived token for a target user on behalf of a platform admin (audited). */
  async impersonate(targetUser: any, byAdminId: string) {
    const payload = { sub: targetUser.id, email: targetUser.email, role: targetUser.role, operatorId: targetUser.operatorId, impersonatedBy: byAdminId };
    const accessToken = this.jwt.sign(payload, { secret: this.config.get('jwt.accessSecret'), expiresIn: '30m' });
    return { accessToken, impersonating: { id: targetUser.id, email: targetUser.email, role: targetUser.role }, byAdminId };
  }

  // ---- Session issuance (access JWT + rotating refresh token) ----
  private async issueSession(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role, operatorId: user.operatorId };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessExpires'),
    });
    const rawRefresh = randomBytes(40).toString('hex');
    await this.refreshRepo.save(this.refreshRepo.create({
      userId: user.id, tokenHash: sha256(rawRefresh),
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    }));
    return {
      accessToken,
      refreshToken: rawRefresh,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, operatorId: user.operatorId },
    };
  }
}
