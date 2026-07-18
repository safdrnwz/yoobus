import { PeriodQueryDto } from './dto/period-query.dto';
import { resolveOperatorScope } from '../../../common/logic/operator-scope.util';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { IsDateString } from 'class-validator';
export class PeriodDto { @IsDateString() from: string; @IsDateString() to: string; }
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}
  // Operator/accountant apna payout preview
  @Roles(Role.OPERATOR_ADMIN, Role.ACCOUNTANT) @Get('preview')
  preview(@CurrentUser() u: JwtUser, @Query() q: PeriodQueryDto) {
    return this.settlements.compute(resolveOperatorScope(u, q.operatorId), q.from, q.to);
  }
  @Roles(Role.OPERATOR_ADMIN, Role.ACCOUNTANT) @Get()
  list(@CurrentUser() u: JwtUser, @Query('operatorId') scopeOp?: string) { return this.settlements.list(resolveOperatorScope(u, scopeOp)); }
  // Superadmin: settlement create + mark paid (platform payout)
  @Roles(Role.SUPERADMIN) @Post(':operatorId')
  create(@Param('operatorId') operatorId: string, @Body() dto: PeriodDto) { return this.settlements.createSettlement(operatorId, dto.from, dto.to); }
  @Roles(Role.SUPERADMIN) @Patch(':id/paid') paid(@Param('id') id: string) { return this.settlements.markPaid(id); }
}
