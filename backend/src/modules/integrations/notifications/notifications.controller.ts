import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Controller, Get, Query } from '@nestjs/common';
import { NotificationsQueryService } from './notifications-query.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsQueryService) {}

  // Customer: my own notification history.
  @Roles(Role.CUSTOMER) @Get('mine')
  mine(@CurrentUser() u: JwtUser) { return this.notifications.myHistory(u.email); }

  // Operator: delivery log for the operator (audit).
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @Get('log')
  log(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.notifications.operatorLog(resolveOperatorScope(u, scopeOp)); }

  // Delivery stats: operator-scoped for operators; platform-wide for superadmin.
  @Roles(Role.OPERATOR_ADMIN, Role.ACCOUNTANT, Role.SUPERADMIN) @Get('stats')
  stats(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.notifications.stats(u.role === Role.SUPERADMIN ? null : resolveOperatorScope(u, scopeOp)); }
}
