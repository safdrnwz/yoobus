import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OperatorsService } from './operators.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ApproveDto, RejectDto, CommissionDto } from './dto/decision.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { OperatorStatus } from '../../../common/enums/operator-status.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';

export class BrandingDto { @IsObject() branding: any; }

/** Partial operator gender-rule configuration (seat-gender spec §15/§24). */
export class GenderRulesDto {
  @IsOptional() @IsIn(['ENABLED', 'DISABLED']) femaleAdjacentProtection?: string;
  @IsOptional() @IsIn(['BLOCK', 'ALLOW']) differentBookingMaleFemale?: string;
  @IsOptional() @IsIn(['ALLOW', 'BLOCK']) sameBookingMaleFemale?: string;
  @IsOptional() @IsBoolean() bothDirectionProtection?: boolean;
  @IsOptional() @IsIn(['ENABLED', 'DISABLED']) familyGroupException?: string;
}

@Controller('operators')
export class OperatorsController {
  constructor(private readonly ops: OperatorsService) {}

  // ---- PUBLIC: homepage "Become an Operator" ----
  @Public() @Post('apply')
  apply(@Body() dto: CreateLeadDto) { return this.ops.createLead(dto); }

  // ---- SUPERADMIN onboarding pipeline ----
  @Roles(Role.SUPERADMIN) @Get('leads')
  leads() { return this.ops.listLeads(); }

  @Roles(Role.SUPERADMIN) @Get('leads/:id')
  lead(@Param('id') id: string) { return this.ops.findLead(id); }

  @Roles(Role.SUPERADMIN) @Patch('leads/:id/contacted')
  contacted(@Param('id') id: string) { return this.ops.markContacted(id); }

  @Roles(Role.SUPERADMIN) @Patch('leads/:id/verify')
  verify(@Param('id') id: string) { return this.ops.startVerification(id); }

  @Roles(Role.SUPERADMIN) @Patch('leads/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveDto) { return this.ops.approve(id, dto); }

  @Roles(Role.SUPERADMIN) @Patch('leads/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectDto) { return this.ops.reject(id, dto.reason); }

  // ---- SUPERADMIN operator management ----
  @Roles(Role.SUPERADMIN) @Get()
  list() { return this.ops.listOperators(); }

  @Roles(Role.SUPERADMIN) @Get(':id')
  get(@Param('id') id: string) { return this.ops.findOperator(id); }

  @Roles(Role.SUPERADMIN) @Patch(':id/commission')
  commission(@Param('id') id: string, @Body() dto: CommissionDto) { return this.ops.setCommission(id, dto.commissionRate); }

  @Roles(Role.SUPERADMIN) @Patch(':id/suspend')
  suspend(@Param('id') id: string, @Body() dto: RejectDto) { return this.ops.setStatus(id, OperatorStatus.SUSPENDED, dto.reason); }

  @Roles(Role.SUPERADMIN) @Patch(':id/activate')
  activate(@Param('id') id: string) { return this.ops.setStatus(id, OperatorStatus.ACTIVE); }

  // Operator-admin sets own storefront branding (operator-scoped).
  @Roles(Role.OPERATOR_ADMIN) @Patch('branding/me')
  setBranding(@CurrentUser() u: JwtUser, @Body() dto: BrandingDto) { return this.ops.setBranding(u.operatorId!, dto.branding); }

  /** Seat-gender spec §15 — operator reads own gender seat rules (defaults merged in). */
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @Get('gender-rules/me')
  getGenderRules(@CurrentUser() u: JwtUser) { return this.ops.getGenderRules(u.operatorId!); }

  /** Seat-gender spec §15 — operator configures own gender seat rules (partial update). */
  @Roles(Role.OPERATOR_ADMIN) @Patch('gender-rules/me')
  setGenderRules(@CurrentUser() u: JwtUser, @Body() dto: GenderRulesDto) { return this.ops.setGenderRules(u.operatorId!, dto as any); }

  // Public storefront branding fetch.
  @Public() @Get(':id/branding')
  getBranding(@Param('id') id: string) { return this.ops.getBranding(id); }
}
