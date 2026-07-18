import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Roles(Role.OPERATOR_ADMIN, Role.ACCOUNTANT) @Get('operator')
  operator(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) {
    return this.analytics.operatorDashboard(resolveOperatorScope(u, scopeOp));
  }

  @Roles(Role.SUPERADMIN) @Get('platform')
  platform() {
    return this.analytics.platformDashboard();
  }
}
