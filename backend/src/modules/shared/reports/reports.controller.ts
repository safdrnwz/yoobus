import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Roles(Role.ACCOUNTANT, Role.OPERATOR_ADMIN) @Get('revenue') revenue(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.reports.revenue(resolveOperatorScope(u, scopeOp)); }
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT, Role.DRIVER) @Get('manifest/:tripId') manifest(@CurrentUser() u: JwtUser, @Param('tripId') tripId: string) { return this.reports.manifest(u.operatorId!, tripId); }
  @Roles(Role.ACCOUNTANT, Role.OPERATOR_ADMIN) @Get('gst') gst(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.reports.gstReport(resolveOperatorScope(u, scopeOp)); }
}
