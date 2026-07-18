import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ReliabilityService } from './reliability.service';
import { LogDeploymentDto, RegisterJobDto } from './dto/reliability.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** SuperAdmin-only reliability/ops endpoints. */
@Roles(Role.SUPERADMIN)
@Controller('platform/reliability')
export class ReliabilityController {
  constructor(private readonly ops: ReliabilityService) {}

  // Background jobs
  @RequirePermission('SCHEDULE_SYSTEM_JOB') @Post('jobs')
  registerJob(@Body() dto: RegisterJobDto) { return this.ops.registerJob(dto.name); }
  @RequirePermission('VIEW_BACKGROUND_JOBS') @Get('jobs')
  listJobs() { return this.ops.listJobs(); }
  @RequirePermission('MANAGE_BACKGROUND_JOBS') @Patch('jobs/:id/status')
  jobStatus(@Param('id') id: string, @Body('status') status: string, @Body('error') error?: string) {
    return this.ops.setJobStatus(id, status as any, error);
  }
  @RequirePermission('MANAGE_BACKGROUND_JOBS') @Patch('jobs/:id/retry')
  retryJob(@Param('id') id: string) { return this.ops.retryJob(id); }

  // Deployments
  @RequirePermission('APPROVE_DEPLOYMENT') @Post('deployments')
  logDeployment(@CurrentUser() user: JwtUser, @Body() dto: LogDeploymentDto) { return this.ops.logDeployment(dto.version, user.id); }
  @RequirePermission('APPROVE_DEPLOYMENT') @Get('deployments')
  listDeployments() { return this.ops.listDeployments(); }
  @RequirePermission('APPROVE_DEPLOYMENT') @Patch('deployments/:id/deploy')
  deploy(@Param('id') id: string) { return this.ops.setDeploymentStatus(id, 'DEPLOYED'); }
  @RequirePermission('ROLLBACK_DEPLOYMENT') @Patch('deployments/:id/rollback')
  rollback(@Param('id') id: string) { return this.ops.setDeploymentStatus(id, 'ROLLED_BACK'); }

  // Impersonation
  @RequirePermission('IMPERSONATE_USER') @Post('impersonate/:userId')
  impersonate(@CurrentUser() user: JwtUser, @Param('userId') userId: string) { return this.ops.impersonate(user.id, userId); }
  @RequirePermission('VIEW_PLATFORM_AUDIT_LOGS') @Get('impersonations')
  impersonations() { return this.ops.listImpersonations(); }
}
