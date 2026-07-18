import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator } from './entities/operator.entity';
import { OperatorLead } from './entities/operator-lead.entity';
import { OperatorStatus } from '../../../common/enums/operator-status.enum';
import { LeadStatus } from '../../../common/enums/lead-status.enum';
import { AppException } from '../../../common/errors/app-exception';
import { checkOperatorDuplicate } from '../../../common/logic/invariants.util';
import { PLATFORM_DEFAULTS } from '../../../common/config/platform-defaults';
import { BillingService } from '../../finance/billing/billing.service';
import { UsersService } from '../../customer/users/users.service';
import { EmailService } from '../../integrations/email/email.service';

@Injectable()
export class OperatorsService {
  constructor(
    @InjectRepository(Operator) private readonly opRepo: Repository<Operator>,
    @InjectRepository(OperatorLead) private readonly leadRepo: Repository<OperatorLead>,
    private readonly users: UsersService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
  ) {}

  // PUBLIC: "Become an Operator" form (bina login)
  async createLead(dto: any) {
    // dedupe: existing operators + active leads
    const kyc = dto.kyc || {};
    const operators = await this.opRepo.find();
    // GSTIN / PAN / email / mobile / legal name must not already belong to an operator.
    // (The operators table also enforces GSTIN & PAN uniqueness at the database level.)
    const dup = checkOperatorDuplicate(
      { gstin: kyc.gstin, pan: kyc.pan, legalName: kyc.legalName || dto.companyName, email: dto.email, mobile: dto.mobile },
      operators.map((o) => ({ gstin: o.gstin, pan: o.pan, legalName: o.legalName, email: o.email, mobile: o.mobile })),
    );
    if (!dup.ok) throw new AppException(dup.code, dup.message, HttpStatus.CONFLICT);

    // Nor may an OPEN application already use the same email or mobile...
    const openLead = await this.leadRepo.createQueryBuilder('l')
      .where('l.status NOT IN (:...closed)', { closed: [LeadStatus.REJECTED, LeadStatus.APPROVED] })
      .andWhere('(l.email = :e OR l.mobile = :m)', { e: dto.email, m: dto.mobile })
      .getOne();
    if (openLead) throw new AppException('LEAD_IN_PROGRESS', 'An application with this email or mobile is already in progress', HttpStatus.CONFLICT);

    // ...or the same GSTIN. One GSTIN can never map to two operators or two live applications.
    if (kyc.gstin) {
      const gstLead = await this.leadRepo.createQueryBuilder('l')
        .where('l.status NOT IN (:...closed)', { closed: [LeadStatus.REJECTED, LeadStatus.APPROVED] })
        .andWhere("l.kyc->>'gstin' = :g", { g: kyc.gstin })
        .getOne();
      if (gstLead) throw new AppException('OPERATOR_DUPLICATE_GSTIN', 'An application with this GSTIN is already in progress', HttpStatus.CONFLICT);
    }

    if (kyc.pan) {
      const panLead = await this.leadRepo.createQueryBuilder('l')
        .where('l.status NOT IN (:...closed)', { closed: [LeadStatus.REJECTED, LeadStatus.APPROVED] })
        .andWhere("l.kyc->>'pan' = :p", { p: kyc.pan })
        .getOne();
      if (panLead) throw new AppException('OPERATOR_DUPLICATE_PAN', 'An application with this PAN is already in progress', HttpStatus.CONFLICT);
    }

    const lead = await this.leadRepo.save(this.leadRepo.create({ ...dto, status: LeadStatus.NEW } as OperatorLead));
    // The apply form already captured every detail and document — no separate KYC step or link.
    await this.email.send({
      to: dto.email,
      template: 'LEAD_RECEIVED',
      vars: { contactName: dto.contactName, companyName: dto.companyName },
      operatorId: null,
    });
    return lead;
  }

  async findLead(id: string) {
    const l = await this.leadRepo.findOne({ where: { id } });
    if (!l) throw new AppException('LEAD_NOT_FOUND', 'Lead not found', HttpStatus.NOT_FOUND);
    return l;
  }

  listLeads() { return this.leadRepo.find({ order: { createdAt: 'DESC' } }); }

  // SUPERADMIN: sales call done
  async markContacted(id: string) {
    const l = await this.findLead(id);
    l.status = LeadStatus.CONTACTED;
    await this.leadRepo.save(l);
    await this.email.send({ to: l.email, template: 'OPERATOR_UNDER_REVIEW', vars: { contactName: l.contactName, companyName: l.companyName }, operatorId: null });
    return l;
  }

  // SUPERADMIN: verification shuru (~24h)
  async startVerification(id: string) {
    const l = await this.findLead(id);
    if (l.status === LeadStatus.APPROVED || l.status === LeadStatus.REJECTED)
      throw new AppException('LEAD_CLOSED', 'This application is already closed.', HttpStatus.BAD_REQUEST);
    l.status = LeadStatus.UNDER_VERIFICATION;
    await this.leadRepo.save(l);
    await this.email.send({ to: l.email, template: 'OPERATOR_VERIFICATION_STARTED', vars: { contactName: l.contactName }, operatorId: null });
    return l;
  }

  // SUPERADMIN: approve -> operator + admin + commission
  async approve(id: string, override: { commissionRate?: number; setupFeePerBus?: number; oneTimePlatformFee?: number; smsCharge?: number; whatsappCharge?: number; emailCharge?: number }) {
    const l = await this.findLead(id);
    if (l.status === LeadStatus.APPROVED) throw new AppException('ALREADY_APPROVED', 'Lead is already approved', HttpStatus.BAD_REQUEST);
    if (l.status === LeadStatus.REJECTED) throw new AppException('LEAD_REJECTED', 'A rejected lead cannot be approved', HttpStatus.BAD_REQUEST);

    const kyc = l.kyc || {};
    // final dedupe (race safety)
    const operators = await this.opRepo.find();
    const dup = checkOperatorDuplicate(
      { gstin: kyc.gstin, pan: kyc.pan, legalName: kyc.legalName || l.companyName, email: l.email, mobile: l.mobile },
      operators.map((o) => ({ gstin: o.gstin, pan: o.pan, legalName: o.legalName, email: o.email, mobile: o.mobile })),
    );
    if (!dup.ok) throw new AppException(dup.code, dup.message, HttpStatus.CONFLICT);

    // New operators start on BASIC; commission comes from the plan unless a superadmin override is given.
    const commissionRate = override.commissionRate ?? PLATFORM_DEFAULTS.PAYMENT.defaultCommissionRate;
    const setupFee = override.setupFeePerBus ?? this.config.get<number>('billing.setupFeePerBus')!;

    // Next human-facing operator code (1, 2, 3, ...), assigned at approval time.
    const maxCode = operators.reduce((mx, o) => Math.max(mx, o.operatorCode ?? 0), 0);
    const operator = await this.opRepo.save(this.opRepo.create({
      legalName: kyc.legalName || l.companyName,
      brandName: l.companyName,
      email: l.email, mobile: l.mobile,
      gstin: kyc.gstin || null, pan: kyc.pan || null,
      address: kyc.address || null, bankDetails: kyc.bankDetails || null, documents: kyc.documents || null,
      commissionRate, setupFeePerBus: setupFee,
      oneTimePlatformFee: override.oneTimePlatformFee ?? 0,
      smsCharge: override.smsCharge ?? 0,
      whatsappCharge: override.whatsappCharge ?? 0,
      emailCharge: override.emailCharge ?? 0,
      status: OperatorStatus.ACTIVE,
      operatorCode: maxCode + 1,
    }));

    // One-time platform fee -> a billable invoice on the operator's account (idempotent).
    if (operator.oneTimePlatformFee > 0) {
      await this.billing.createPlatformFeeInvoice(operator.id, Number(operator.oneTimePlatformFee)).catch(() => null);
    }

    const tempPassword = Math.random().toString(36).slice(-8) + 'A1@';
    const admin = await this.users.createOperatorAdmin(operator.id, l.contactName, l.email, tempPassword);

    l.status = LeadStatus.APPROVED; l.operatorId = operator.id;
    await this.leadRepo.save(l);

    const signInUrl = (this.config.get<string>('app.frontendUrl') || 'http://localhost:5173') + '/signin';
    await this.email.send({
      to: l.email, template: 'OPERATOR_APPROVED',
      vars: { contactName: l.contactName, companyName: l.companyName, adminEmail: admin.email, tempPassword, commissionRate, setupFee, operatorCode: operator.operatorCode, signInUrl },
      operatorId: operator.id, recipientOperatorId: operator.id,
    });
    // SECURITY: credentials are emailed to the operator only — never returned in the API response.
    return { operator, operatorCode: operator.operatorCode, message: `Operator approved. Login credentials have been emailed to ${admin.email}.` };
  }

  async reject(id: string, reason: string) {
    const l = await this.findLead(id);
    l.status = LeadStatus.REJECTED; l.statusReason = reason;
    await this.leadRepo.save(l);
    await this.email.send({ to: l.email, template: 'OPERATOR_REJECTED', vars: { contactName: l.contactName, reason }, operatorId: null });
    return l;
  }

  listOperators() { return this.opRepo.find({ order: { createdAt: 'DESC' } }); }

  async findOperator(id: string) {
    const o = await this.opRepo.findOne({ where: { id } });
    if (!o) throw new AppException('OPERATOR_NOT_FOUND', 'Operator not found', HttpStatus.NOT_FOUND);
    return o;
  }

  // SUPERADMIN per-operator commission set
  async setCommission(id: string, rate: number) {
    const o = await this.findOperator(id);
    o.commissionRate = rate;
    const saved = await this.opRepo.save(o);
    await this.email.send({
      to: o.email,
      template: 'COMMISSION_UPDATED',
      vars: { operatorName: o.brandName || o.legalName, commissionRate: rate },
      operatorId: o.id,
      recipientOperatorId: o.id,
    });
    return saved;
  }

  // Phase 3: white-label branding (operator-admin sets own; public reads storefront).
  async setBranding(operatorId: string, branding: any) {
    const o = await this.findOperator(operatorId);
    o.branding = branding;
    return this.opRepo.save(o);
  }

  async getBranding(operatorId: string) {
    const o = await this.findOperator(operatorId);
    return { operatorId: o.id, brandName: o.brandName, branding: o.branding ?? {} };
  }

  async setStatus(id: string, status: OperatorStatus, reason?: string) {
    const o = await this.findOperator(id);
    o.status = status;
    o.statusReason = reason || (null as any);
    const saved = await this.opRepo.save(o);
    const template =
      status === OperatorStatus.SUSPENDED
        ? 'OPERATOR_SUSPENDED'
        : status === OperatorStatus.ACTIVE
          ? 'OPERATOR_REACTIVATED'
          : null;
    if (template) {
      await this.email.send({
        to: o.email,
        template,
        vars: { operatorName: o.brandName || o.legalName, reason },
        operatorId: o.id,
        recipientOperatorId: o.id,
      });
    }
    return saved;
  }
}
