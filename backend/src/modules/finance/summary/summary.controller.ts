import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Controller, Get, Query } from '@nestjs/common';
import { FinanceSummaryService } from './summary.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator finance control panel. */
@Roles(Role.OPERATOR_ADMIN, Role.ACCOUNTANT)
@Controller('finance/summary')
export class FinanceSummaryController {
  constructor(private readonly summary: FinanceSummaryService) {}

  @Get() operator(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.summary.operatorSummary(resolveOperatorScope(u, scopeOp), { from, to });
  }
}
