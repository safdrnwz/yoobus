import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator control panel (one integrated call). */
@Roles(Role.OPERATOR_ADMIN, Role.SUPPORT)
@Controller('operator/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get() overview(@CurrentUser() u: JwtUser, @Query('from') from?: string, @Query('to') to?: string) { return this.dashboard.overview(u.operatorId!, { from, to }); }
}
