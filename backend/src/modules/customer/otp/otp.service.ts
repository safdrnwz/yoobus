import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Otp } from './entities/otp.entity';
import { UsersService } from '../users/users.service';
import { EmailService } from '../../integrations/email/email.service';
import { AppException } from '../../../common/errors/app-exception';
import { canResend, verifyOtp, OTP_TTL_MS } from '../../../common/logic/otp.util';
import { MessagingService } from '../../integrations/messaging/messaging.service';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(Otp) private readonly repo: Repository<Otp>,
    private readonly users: UsersService,
    private readonly email: EmailService,
    private readonly messaging: MessagingService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hash(code: string) { return crypto.createHash('sha256').update(code).digest('hex'); }

  /**
   * Dev-only: hand the OTP straight back in the response.
   *
   * With EMAIL_DEV_MODE=true there is no SMTP, so nothing is actually delivered — without
   * this you could never complete a registration from the UI or a test. It is gated on BOTH
   * the dev-mode flag and NODE_ENV, so it can never surface in production.
   */
  private devEcho(code: string): { devOtp?: string } {
    const devMode = this.config.get<boolean>('email.devMode');
    const isProd = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    return devMode && !isProd ? { devOtp: code } : {};
  }


  async request(dto: {
    email: string;
    purpose: string;
    fullName?: string;
    phone?: string;
    pendingPassword?: string;   // pre-hashed password from AuthService.register()
    consentGiven?: boolean;
  }) {
    const existing = await this.repo.findOne({
      where: { email: dto.email, purpose: dto.purpose, consumed: false },
      order: { createdAt: 'DESC' },
    });
    const now = Date.now();
    if (existing) {
      const r = canResend({
        codeHash: existing.codeHash,
        expiresAt: existing.expiresAt.getTime(),
        attempts: existing.attempts,
        lastSentAt: existing.lastSentAt.getTime(),
      }, now);
      if (!r.ok) throw new AppException('OTP_COOLDOWN', `Too many requests. Please try again in about ${Math.ceil(r.waitMs / 1000)} seconds.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    // For REGISTER purpose, the email must not already be in use.
    if (dto.purpose === 'REGISTER') {
      const passenger = await this.users.findPassengerByEmail(dto.email);
      if (passenger) throw new AppException('EMAIL_TAKEN', 'This email is already registered. Please log in instead.', HttpStatus.CONFLICT);
    }

    const code = '' + Math.floor(100000 + Math.random() * 900000); // 6-digit

    // Store the full pending profile (including the hashed password) so we can
    // create the account in verifyForRegistration() without asking again.
    const pendingProfile = dto.purpose === 'REGISTER' ? {
      fullName: dto.fullName,
      phone: dto.phone,
      passwordHash: dto.pendingPassword ?? null,
      consentGiven: dto.consentGiven ?? false,
    } : null;

    const otp = await this.repo.save(this.repo.create({
      email: dto.email,
      purpose: dto.purpose,
      codeHash: this.hash(code),
      expiresAt: new Date(now + OTP_TTL_MS),
      attempts: 0,
      lastSentAt: new Date(now),
      pendingProfile,
    }));

    // Send OTP via email.
    await this.email.send({
      to: dto.email,
      template: dto.purpose === 'LOGIN' ? 'OTP_LOGIN' : 'OTP_REGISTER',
      vars: { otp: code, expiryMin: 5, fullName: dto.fullName ?? 'User' },
      operatorId: null,
    });

    // Also deliver over SMS/WhatsApp when a phone number is available (best-effort).
    if (dto.phone) {
      await this.messaging
        .notify(dto.phone, `Your Yoo Bus OTP is ${code}. It expires in 5 minutes. Do not share it with anyone.`)
        .catch(() => { /* SMS is best-effort - never block registration */ });
    }

    return { otpId: otp.id, message: 'OTP sent successfully', ...this.devEcho(code) };
  }

  /**
   * Generic OTP issuance for flows other than registration:
   *  - PASSWORD_RESET   (deliver to email and/or phone)
   *  - UPDATE_EMAIL     (deliver to the NEW email being claimed)
   *  - UPDATE_PHONE     (deliver to the NEW phone being claimed)
   * `channelEmail` / `channelPhone` are where the code is sent.
   * `keyEmail` is the OTP row's lookup key (defaults to channelEmail).
   * `payload` is stashed in pendingProfile for the verify step.
   */
  async requestOtp(dto: {
    purpose: string;
    keyEmail: string;
    channelEmail?: string;
    channelPhone?: string;
    payload?: any;
  }) {
    const existing = await this.repo.findOne({
      where: { email: dto.keyEmail, purpose: dto.purpose, consumed: false },
      order: { createdAt: 'DESC' },
    });
    const now = Date.now();
    if (existing) {
      const r = canResend({ codeHash: existing.codeHash, expiresAt: existing.expiresAt.getTime(), attempts: existing.attempts, lastSentAt: existing.lastSentAt.getTime() }, now);
      if (!r.ok) throw new AppException('OTP_COOLDOWN', `Too many requests. Please try again in about ${Math.ceil(r.waitMs / 1000)} seconds.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = '' + Math.floor(100000 + Math.random() * 900000);
    const otp = await this.repo.save(this.repo.create({
      email: dto.keyEmail, purpose: dto.purpose, codeHash: this.hash(code),
      expiresAt: new Date(now + OTP_TTL_MS), attempts: 0, lastSentAt: new Date(now),
      pendingProfile: dto.payload ?? null,
    }));
    if (dto.channelEmail) {
      await this.email.send({ to: dto.channelEmail, template: 'OTP_LOGIN', vars: { otp: code, expiryMin: 5, fullName: 'User' }, operatorId: null }).catch(() => {});
    }
    if (dto.channelPhone) {
      await this.messaging.notify(dto.channelPhone, `Your Yoo Bus OTP is ${code}. It expires in 5 minutes. Do not share it with anyone.`).catch(() => {});
    }
    return { otpId: otp.id, message: 'OTP sent successfully', ...this.devEcho(code) };
  }

  /**
   * Verifies an OTP for a given (keyEmail, purpose) and returns its stashed payload.
   * Marks the OTP consumed on success. Increments attempts on a wrong code.
   */
  async verifyPurpose(keyEmail: string, purpose: string, code: string): Promise<{ payload: any }> {
    const otp = await this.repo.findOne({ where: { email: keyEmail, purpose, consumed: false }, order: { createdAt: 'DESC' } });
    const now = Date.now();
    const res = verifyOtp(
      otp ? { codeHash: otp.codeHash, expiresAt: otp.expiresAt.getTime(), attempts: otp.attempts, lastSentAt: otp.lastSentAt.getTime() } : null,
      otp ? this.hash(code) : 'x', now,
    );
    if (!res.ok) {
      if (otp && res.code === 'OTP_INVALID') { otp.attempts += 1; await this.repo.save(otp); }
      throw new AppException(res.code!, res.message!, HttpStatus.BAD_REQUEST);
    }
    otp!.consumed = true;
    await this.repo.save(otp!);
    return { payload: otp!.pendingProfile ?? {} };
  }

  /**
   * Verifies a REGISTER-purpose OTP.
   * On success, creates the user account using the password hash stored in the
   * OTP row at request() time, marks the email verified, and returns the new
   * User entity so AuthService can issue a full session (auto-login).
   */
  async verifyForRegistration(email: string, code: string) {
    const otp = await this.repo.findOne({
      where: { email, purpose: 'REGISTER', consumed: false },
      order: { createdAt: 'DESC' },
    });
    const now = Date.now();
    const res = verifyOtp(
      otp
        ? { codeHash: otp.codeHash, expiresAt: otp.expiresAt.getTime(), attempts: otp.attempts, lastSentAt: otp.lastSentAt.getTime() }
        : null,
      otp ? this.hash(code) : 'x',
      now,
    );
    if (!res.ok) {
      if (otp && res.code === 'OTP_INVALID') { otp.attempts += 1; await this.repo.save(otp); }
      throw new AppException(res.code!, res.message!, HttpStatus.BAD_REQUEST);
    }

    otp!.consumed = true;
    await this.repo.save(otp!);

    const profile = otp!.pendingProfile ?? {};

    // Create the account with the pre-hashed password captured at registration.
    const user = await this.users.createPassengerFromOtp({
      email,
      fullName: profile.fullName ?? 'User',
      phone: profile.phone ?? null,
      passwordHash: profile.passwordHash ?? null,
      consentGiven: profile.consentGiven ?? false,
      emailVerified: true, // OTP confirmation == email verified
    });

    return { user };
  }

  /** Generic OTP verify (legacy /otp/verify endpoint, used for LOGIN purpose). */
  async verify(dto: { email: string; code: string }) {
    const otp = await this.repo.findOne({
      where: { email: dto.email, consumed: false },
      order: { createdAt: 'DESC' },
    });
    const now = Date.now();
    const res = verifyOtp(
      otp
        ? { codeHash: otp.codeHash, expiresAt: otp.expiresAt.getTime(), attempts: otp.attempts, lastSentAt: otp.lastSentAt.getTime() }
        : null,
      otp ? this.hash(dto.code) : 'x',
      now,
    );
    if (!res.ok) {
      if (otp && res.code === 'OTP_INVALID') { otp.attempts += 1; await this.repo.save(otp); }
      throw new AppException(res.code!, res.message!, HttpStatus.BAD_REQUEST);
    }
    otp!.consumed = true;
    await this.repo.save(otp!);

    let user = await this.users.findPassengerByEmail(dto.email);
    if (!user) {
      if (otp!.purpose !== 'REGISTER') throw new AppException('USER_NOT_FOUND', 'Account not found - please register first', HttpStatus.NOT_FOUND);
      user = await this.users.createPassengerViaOtp(
        dto.email,
        otp!.pendingProfile?.fullName ?? 'Passenger',
        otp!.pendingProfile?.phone,
      );
    }

    const token = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role, operatorId: null },
      { secret: this.config.get('jwt.accessSecret'), expiresIn: this.config.get('jwt.accessExpires') },
    );
    return {
      accessToken: token,
      passwordSet: user.passwordSet === true,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    };
  }
}
