import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Role, OPERATOR_CREATABLE_ROLES, PLATFORM_CREATABLE_ROLES, PLATFORM_ROLES } from '../../../common/enums/role.enum';
import { AppException } from '../../../common/errors/app-exception';
import { EmailService } from '../../integrations/email/email.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly email: EmailService,
  ) {}

  findByEmailForLogin(email: string, operatorId: string | null) {
    const qb = this.repo.createQueryBuilder('u').addSelect('u.password').where('u.email = :email', { email });
    if (operatorId === null) qb.andWhere('u.operatorId IS NULL');
    else qb.andWhere('u.operatorId = :op', { op: operatorId });
    return qb.getOne();
  }

  // login: email match across any context (passenger OR staff). First active.
  findAnyByEmailForLogin(email: string) {
    return this.repo.createQueryBuilder('u').addSelect('u.password')
      .where('u.email = :email', { email }).orderBy('u.createdAt', 'ASC').getOne();
  }

  /** Lookup by 10-digit phone number for the mobile-login path. */
  findByPhoneForLogin(phone: string) {
    return this.repo.createQueryBuilder('u').addSelect('u.password')
      .where('u.phone = :phone', { phone }).orderBy('u.createdAt', 'ASC').getOne();
  }

  async findById(id: string) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new AppException('USER_NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    return u;
  }

  /**
   * Same lookup, but returns null instead of throwing.
   *
   * The JWT strategy must use THIS one. It used to call findById(), which throws a 404 —
   * so a token belonging to a deleted or deactivated account came back as
   * "404 USER_NOT_FOUND" instead of "401 Unauthorized". The strategy's own
   * `if (!u || !u.isActive) -> 401` line could never even run. A revoked credential must
   * read as unauthorised, not as a missing page.
   */
  findByIdOrNull(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  // Passenger registration (operatorId null)
  async createPassenger(data: { fullName: string; email: string; phone?: string; password: string; consentGiven?: boolean }) {
    const exists = await this.repo.findOne({ where: { email: data.email, operatorId: IsNull() } });
    if (exists) throw new AppException('EMAIL_TAKEN', 'This email is already registered', HttpStatus.CONFLICT);
    const user = await this.repo.save(this.repo.create({
      ...data, password: await bcrypt.hash(data.password, 10), role: Role.CUSTOMER, operatorId: null, passwordSet: true,
      consentGiven: !!data.consentGiven,
    }));
    await this.email.send({ to: user.email, template: 'WELCOME_USER', vars: { name: user.fullName }, operatorId: null });
    return user;
  }

  findPassengerByEmail(email: string) {
    return this.repo.findOne({ where: { email, operatorId: IsNull() } });
  }

  // OTP-verified guest => passenger account (random password, consent true)
  async createPassengerViaOtp(email: string, fullName: string, phone?: string) {
    const existing = await this.repo.findOne({ where: { email, operatorId: IsNull() } });
    if (existing) return existing;
    const randomPass = await bcrypt.hash(Math.random().toString(36) + 'A1@', 10);
    return this.repo.save(this.repo.create({
      email, fullName, phone, password: randomPass, role: Role.CUSTOMER, operatorId: null, consentGiven: true,
    }));
  }

  /**
   * Creates a passenger account from a completed OTP registration flow.
   * Accepts a pre-hashed password so AuthService.register() can validate the
   * password policy and hash it once - we store the hash directly here.
   */
  async createPassengerFromOtp(data: {
    email: string;
    fullName: string;
    phone?: string | null;
    passwordHash?: string | null;
    consentGiven?: boolean;
    emailVerified?: boolean;
  }) {
    // Guard: check with-deleted too so a deactivated email cannot be reused.
    const existing = await this.repo.findOne({ where: { email: data.email, operatorId: IsNull() }, withDeleted: true });
    if (existing) throw new AppException('EMAIL_TAKEN', 'This email is already registered.', HttpStatus.CONFLICT);

    const password = data.passwordHash ?? await bcrypt.hash(Math.random().toString(36) + 'A1@', 10);
    return this.repo.save(this.repo.create({
      email: data.email,
      fullName: data.fullName,
      phone: data.phone ?? undefined,
      password,
      passwordSet: !!data.passwordHash,
      emailVerified: data.emailVerified ?? false,
      role: Role.CUSTOMER,
      consentGiven: data.consentGiven ?? false,
      isActive: true,
    })) as Promise<User>;
  }

  // Internal helper used to create the operator admin account at approval time.
  async createOperatorAdmin(operatorId: string, fullName: string, email: string, tempPassword: string) {
    const user = await this.repo.save(this.repo.create({
      fullName, email, password: await bcrypt.hash(tempPassword, 10),
      role: Role.OPERATOR_ADMIN, operatorId,
    }));
    return user;
  }

  // The operator admin creates staff within their own operator.
  async createStaff(actorOperatorId: string, operatorName: string, dto: { fullName: string; email: string; role: Role; phone?: string }) {
    if (!OPERATOR_CREATABLE_ROLES.includes(dto.role))
      throw new AppException('INVALID_STAFF_ROLE', `Operator may only create these roles: ${OPERATOR_CREATABLE_ROLES.join(', ')}`, HttpStatus.BAD_REQUEST);
    const exists = await this.repo.findOne({ where: { email: dto.email, operatorId: actorOperatorId } });
    if (exists) throw new AppException('EMAIL_TAKEN', 'This email already exists for this operator', HttpStatus.CONFLICT);
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1@';
    const user = await this.repo.save(this.repo.create({
      fullName: dto.fullName, email: dto.email, phone: dto.phone,
      password: await bcrypt.hash(tempPassword, 10), role: dto.role, operatorId: actorOperatorId,
    }));
    // operator-scoped email -> recipient operatorId == actorOperatorId (isolation safe)
    await this.email.send({
      to: user.email, template: 'STAFF_CREATED',
      vars: { name: user.fullName, role: dto.role, operatorName, email: user.email, tempPassword },
      operatorId: actorOperatorId, recipientOperatorId: actorOperatorId,
    });
    return { user, tempPassword };
  }

  listStaff(operatorId: string) {
    return this.repo.find({ where: { operatorId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Yoo Bus's OWN staff — the platform team. These people belong to no operator
   * (operatorId = null) and sit above every operator: the Accountant runs SaaS billing,
   * Platform Support answers across all operators.
   *
   * Only the SuperAdmin may call this, and only for PLATFORM_CREATABLE_ROLES — so a
   * second SuperAdmin can never be minted through this door.
   */
  async createPlatformStaff(dto: { fullName: string; email: string; role: Role; phone?: string }) {
    if (!PLATFORM_CREATABLE_ROLES.includes(dto.role))
      throw new AppException(
        'INVALID_PLATFORM_ROLE',
        `Platform staff may only be one of: ${PLATFORM_CREATABLE_ROLES.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    const exists = await this.repo.findOne({ where: { email: dto.email, operatorId: IsNull() } });
    if (exists) throw new AppException('EMAIL_TAKEN', 'This email already exists at platform level', HttpStatus.CONFLICT);

    const tempPassword = Math.random().toString(36).slice(-8) + 'A1@';
    const user = await this.repo.save(
      this.repo.create({
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        password: await bcrypt.hash(tempPassword, 10),
        role: dto.role,
        operatorId: null, // platform staff belong to no operator
      }),
    );
    await this.email.send({
      to: user.email,
      template: 'STAFF_CREATED',
      vars: { name: user.fullName, role: dto.role, operatorName: 'Yoo Bus', email: user.email, tempPassword },
      operatorId: null,
      recipientOperatorId: null,
    });
    return { user, tempPassword };
  }

  /** Yoo Bus's own team. Operator staff are never included. */
  listPlatformStaff() {
    return this.repo.find({
      where: PLATFORM_ROLES.map((role) => ({ role, operatorId: IsNull() })),
      order: { createdAt: 'DESC' },
    });
  }

  async ensureSuperadmin(email: string, password: string) {
    const existing = await this.repo.findOne({ where: { email, operatorId: IsNull() } });
    if (existing) return existing;
    return this.repo.save(this.repo.create({
      fullName: 'Platform Superadmin', email, password: await bcrypt.hash(password, 10),
      role: Role.SUPERADMIN, operatorId: null,
    }));
  }

  /** Updates a user's password hash (used by the reset flow). */
  findByIdWithPassword(id: string) {
    return this.repo.createQueryBuilder('u').addSelect('u.password').where('u.id = :id', { id }).getOne();
  }

  async updateProfile(userId: string, data: { fullName?: string; phone?: string; dateOfBirth?: string; gender?: string }) {
    const patch: any = {};
    if (data.fullName !== undefined) patch.fullName = data.fullName;
    if (data.phone !== undefined) {
      // Enforce global mobile uniqueness (excluding this user), including soft-deleted rows.
      const clash = await this.repo.createQueryBuilder('u').withDeleted()
        .where('u.phone = :phone AND u.id != :id AND u."operatorId" IS NULL', { phone: data.phone, id: userId })
        .getOne();
      if (clash) throw new AppException('PHONE_TAKEN', 'This mobile number is already in use by another account.', HttpStatus.CONFLICT);
      patch.phone = data.phone;
    }
    if (data.dateOfBirth !== undefined) patch.dateOfBirth = data.dateOfBirth;
    if (data.gender !== undefined) patch.gender = data.gender;
    await this.repo.update({ id: userId }, patch);
    return this.findById(userId);
  }

  /** Returns whether a passenger's profile is complete enough to book. */
  async profileCompletion(userId: string) {
    const u = await this.findById(userId);
    const missing: string[] = [];
    if (!u.fullName || u.fullName.trim().length < 2) missing.push('Full Name');
    if (!u.dateOfBirth) missing.push('Date of Birth');
    if (!u.gender) missing.push('Gender');
    return { complete: missing.length === 0, missing };
  }

  /** DPDP right-to-erasure: soft-delete + deactivate the account. */
  async deactivate(userId: string) {
    await this.repo.update({ id: userId }, { isActive: false } as any);
    await this.repo.softDelete({ id: userId });
    return { ok: true };
  }

  async markEmailVerified(userId: string) {
    await this.repo.update({ id: userId }, { emailVerified: true } as any);
  }

  async markPhoneVerified(userId: string) {
    await this.repo.update({ id: userId }, { phoneVerified: true } as any);
  }

  /** Throws if the email is already claimed by another passenger account. */
  async assertEmailAvailable(email: string, excludeUserId: string) {
    const clash = await this.repo.createQueryBuilder('u').withDeleted()
      .where('LOWER(u.email) = LOWER(:email) AND u.id != :id AND u."operatorId" IS NULL', { email, id: excludeUserId })
      .getOne();
    if (clash) throw new AppException('EMAIL_TAKEN', 'This email is already in use by another account.', HttpStatus.CONFLICT);
  }

  /** Throws if the phone is already claimed by another passenger account. */
  async assertPhoneAvailable(phone: string, excludeUserId: string) {
    const clash = await this.repo.createQueryBuilder('u').withDeleted()
      .where('u.phone = :phone AND u.id != :id AND u."operatorId" IS NULL', { phone, id: excludeUserId })
      .getOne();
    if (clash) throw new AppException('PHONE_TAKEN', 'This mobile number is already in use by another account.', HttpStatus.CONFLICT);
  }

  /** Applies a verified email change (called only after OTP verification). */
  async applyEmailChange(userId: string, newEmail: string) {
    await this.assertEmailAvailable(newEmail, userId);
    await this.repo.update({ id: userId }, { email: newEmail, emailVerified: true } as any);
    return this.findById(userId);
  }

  /** Applies a verified phone change (called only after OTP verification). */
  async applyPhoneChange(userId: string, newPhone: string) {
    await this.assertPhoneAvailable(newPhone, userId);
    await this.repo.update({ id: userId }, { phone: newPhone, phoneVerified: true } as any);
    return this.findById(userId);
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.repo.update({ id: userId }, { password: passwordHash, passwordSet: true });
    return { updated: true };
  }

}
