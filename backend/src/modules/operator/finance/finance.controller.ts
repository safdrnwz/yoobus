import { AppException } from '../../../common/errors/app-exception';
import { Body, Controller, Get, Param, Patch, Post, Query, HttpStatus } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { PostJournalDto } from './dto/finance.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** An accounting period is a month: YYYY-MM. Anything else used to reach the service and 500. */
function assertPeriod(period: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new AppException('INVALID_PERIOD', `Period must look like 2026-07, got '${period}'.`, HttpStatus.BAD_REQUEST);
  }
  return period;
}

/** These routes are operator-scoped: a caller with no operator has nothing to close. */
function assertOperator(u: JwtUser): string {
  if (!u.operatorId) {
    throw new AppException('NO_OPERATOR_CONTEXT', 'This account is not attached to any operator.', HttpStatus.FORBIDDEN);
  }
  return u.operatorId;
}

/** Operator accounting endpoints. */
@Roles(Role.OPERATOR_ADMIN)

@Controller('operator/finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @RequirePermission('CREATE_INVOICE') @Post('journal')
  post(@CurrentUser() u: JwtUser, @Body() dto: PostJournalDto) { return this.finance.postJournal(u.operatorId!, u.id, dto); }
  @RequirePermission('VIEW_LEDGER') @Get('journal')
  list(@CurrentUser() u: JwtUser, @Query('period') period?: string) { return this.finance.listJournal(u.operatorId!, period); }
  @RequirePermission('VIEW_LEDGER') @Get('trial-balance')
  trialBalance(@CurrentUser() u: JwtUser, @Query('period') period?: string) { return this.finance.trialBalance(u.operatorId!, period); }
  @RequirePermission('VIEW_FINANCIAL_DASHBOARD') @Get('periods')
  periods(@CurrentUser() u: JwtUser) { return this.finance.listPeriods(assertOperator(u)); }
  @RequirePermission('CLOSE_FINANCIAL_PERIOD') @Patch('periods/:period/close')
  close(@CurrentUser() u: JwtUser, @Param('period') period: string) {
    return this.finance.closePeriod(assertOperator(u), assertPeriod(period));
  }
  @RequirePermission('CLOSE_FINANCIAL_PERIOD') @Patch('periods/:period/reopen')
  reopen(@CurrentUser() u: JwtUser, @Param('period') period: string) {
    return this.finance.reopenPeriod(assertOperator(u), assertPeriod(period));
  }
}
