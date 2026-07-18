import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { CreateDsrDto, RecordConsentDto, RotateKeyDto } from './dto/compliance.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** SuperAdmin-only compliance endpoints. SUPPORT may file/view DSRs where permitted. */
@Roles(Role.SUPERADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT)
@Controller('platform/compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @RequirePermission('PROCESS_DATA_ACCESS_REQUEST') @Post('requests')
  createRequest(@Body() dto: CreateDsrDto) { return this.compliance.createRequest(dto); }

  @RequirePermission('PROCESS_DATA_ACCESS_REQUEST') @Get('requests')
  listRequests() { return this.compliance.listRequests(); }

  @RequirePermission('PROCESS_DATA_DELETION_REQUEST') @Patch('requests/:id/status')
  advance(@Param('id') id: string, @Body('status') status: string) { return this.compliance.advanceRequest(id, status as any); }

  @RequirePermission('CONFIGURE_CONSENT') @Post('consent')
  recordConsent(@Body() dto: RecordConsentDto) { return this.compliance.recordConsent(dto); }

  @RequirePermission('CONFIGURE_CONSENT') @Get('consent')
  consentStatus(@Query('subjectEmail') subjectEmail: string, @Query('purpose') purpose: string) {
    return this.compliance.consentStatus(subjectEmail, purpose);
  }

  @RequirePermission('CONFIGURE_ENCRYPTION_KEYS') @Post('keys/rotate')
  rotateKey(@CurrentUser() user: JwtUser, @Body() dto: RotateKeyDto) { return this.compliance.rotateKey(dto, user.id); }

  @RequirePermission('CONFIGURE_ENCRYPTION_KEYS') @Get('keys/rotations')
  keyRotations() { return this.compliance.listKeyRotations(); }
}
