import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Controller, Get, Query } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Roles(Role.OPERATOR_ADMIN, Role.ACCOUNTANT) @Get('invoices')
  invoices(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.billing.listInvoices(resolveOperatorScope(u, scopeOp)); }
  @Roles(Role.OPERATOR_ADMIN, Role.ACCOUNTANT) @Get('commission')
  commission(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.billing.commissionSummary(resolveOperatorScope(u, scopeOp)); }
  @Roles(Role.SUPERADMIN) @Get('platform/commission')
  platform() { return this.billing.platformCommission(); }
}
