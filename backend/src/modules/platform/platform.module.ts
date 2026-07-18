import { Module } from '@nestjs/common';
import { NotificationSettingsModule } from './notification-settings/notification-settings.module';
import { CustomRolesModule } from './custom-roles/custom-roles.module';
import { CorporateModule } from './corporate/corporate.module';
import { AdminModule } from './admin/admin.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ApiManagementModule } from './api-management/api-management.module';
import { ReliabilityModule } from './reliability/reliability.module';
import { AuditModule } from './audit/audit.module';
import { SaasBillingModule } from './saas-billing/saas-billing.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';
import { AnalyticsModule } from './analytics/analytics.module';

/** Platform domain barrel — aggregates all platform feature modules. */
@Module({
  imports: [CustomRolesModule, NotificationSettingsModule, CorporateModule, AdminModule, ComplianceModule, ApiManagementModule, ReliabilityModule, AuditModule, SaasBillingModule, PlatformConfigModule, AnalyticsModule],
  exports: [CustomRolesModule, NotificationSettingsModule, CorporateModule, AdminModule, ComplianceModule, ApiManagementModule, ReliabilityModule, AuditModule, SaasBillingModule, PlatformConfigModule, AnalyticsModule],
})
export class PlatformModule {}
