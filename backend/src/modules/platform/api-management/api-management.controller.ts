import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiManagementService } from './api-management.service';
import { CreateVersionDto, GenerateKeyDto, RegisterPartnerDto, RegisterWebhookDto, TestWebhookDto } from './dto/api.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

/** SuperAdmin-only API Management endpoints. */
@Roles(Role.SUPERADMIN)
@Controller('api-management')
export class ApiManagementController {
  constructor(private readonly api: ApiManagementService) {}

  // Partners
  @RequirePermission('CREATE_API_PARTNER') @Post('partners') register(@Body() dto: RegisterPartnerDto) { return this.api.registerPartner(dto); }
  @RequirePermission('VIEW_API_USAGE') @Get('partners') listPartners() { return this.api.listPartners(); }
  @RequirePermission('APPROVE_API_PARTNER') @Patch('partners/:id/approve') approve(@Param('id') id: string) { return this.api.setPartnerStatus(id, 'APPROVED'); }
  @RequirePermission('APPROVE_API_PARTNER') @Patch('partners/:id/reject') reject(@Param('id') id: string, @Body('reason') reason?: string) { return this.api.setPartnerStatus(id, 'REJECTED', reason); }
  @RequirePermission('SUSPEND_API_PARTNER') @Patch('partners/:id/suspend') suspend(@Param('id') id: string, @Body('reason') reason?: string) { return this.api.setPartnerStatus(id, 'SUSPENDED', reason); }
  @RequirePermission('SUSPEND_API_PARTNER') @Patch('partners/:id/reactivate') reactivate(@Param('id') id: string) { return this.api.setPartnerStatus(id, 'APPROVED'); }

  // API keys
  @RequirePermission('GENERATE_API_KEY') @Post('partners/:id/keys') generateKey(@Param('id') id: string, @Body() dto: GenerateKeyDto) { return this.api.generateKey(id, dto); }
  @RequirePermission('VIEW_API_USAGE') @Get('partners/:id/keys') listKeys(@Param('id') id: string) { return this.api.listKeys(id); }
  @RequirePermission('REVOKE_API_KEY') @Patch('keys/:keyId/revoke') revokeKey(@Param('keyId') keyId: string) { return this.api.revokeKey(keyId); }

  // Webhooks
  @RequirePermission('CONFIGURE_WEBHOOKS') @Post('partners/:id/webhooks') registerWebhook(@Param('id') id: string, @Body() dto: RegisterWebhookDto) { return this.api.registerWebhook(id, dto); }
  @RequirePermission('CONFIGURE_WEBHOOKS') @Get('partners/:id/webhooks') listWebhooks(@Param('id') id: string) { return this.api.listWebhooks(id); }
  @RequirePermission('CONFIGURE_WEBHOOKS') @Post('webhooks/:webhookId/test') testWebhook(@Param('webhookId') webhookId: string, @Body() dto: TestWebhookDto) { return this.api.testWebhook(webhookId, dto); }
  @RequirePermission('VIEW_API_USAGE') @Get('webhooks/:webhookId/deliveries') deliveries(@Param('webhookId') webhookId: string) { return this.api.deliveries(webhookId); }

  // Versions
  @RequirePermission('MANAGE_API_VERSIONS') @Post('versions') createVersion(@Body() dto: CreateVersionDto) { return this.api.createVersion(dto); }
  @RequirePermission('VIEW_API_USAGE') @Get('versions') listVersions() { return this.api.listVersions(); }
  @RequirePermission('MANAGE_API_VERSIONS') @Patch('versions/:id/deprecate') deprecate(@Param('id') id: string) { return this.api.setVersionStatus(id, 'DEPRECATED'); }
  @RequirePermission('MANAGE_API_VERSIONS') @Patch('versions/:id/retire') retire(@Param('id') id: string) { return this.api.setVersionStatus(id, 'RETIRED'); }
}
