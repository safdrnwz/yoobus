import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CounterService } from './counter.service';
import { CreateAgentDto, CreateCounterDto, RecordSaleDto } from './dto/counter.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('operator/counters')
export class CounterController {
  constructor(private readonly counter: CounterService) {}

  @Roles(Role.OPERATOR_ADMIN) @RequirePermission('MANAGE_COUNTER') @Post()
  createCounter(@CurrentUser() u: JwtUser, @Body() dto: CreateCounterDto) { return this.counter.createCounter(u.operatorId!, dto); }
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @RequirePermission('VIEW_COUNTER') @Get()
  listCounters(@CurrentUser() u: JwtUser) { return this.counter.listCounters(u.operatorId!); }

  @Roles(Role.OPERATOR_ADMIN) @RequirePermission('MANAGE_COUNTER') @Post('agents')
  createAgent(@CurrentUser() u: JwtUser, @Body() dto: CreateAgentDto) { return this.counter.createAgent(u.operatorId!, dto); }
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @RequirePermission('VIEW_COUNTER') @Get('agents')
  listAgents(@CurrentUser() u: JwtUser) { return this.counter.listAgents(u.operatorId!); }

  // Walk-in sale: confirms the booking (cash/UPI/card) and logs the counter sale.
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @RequirePermission('COUNTER_SALE') @Post('sale')
  recordSale(@CurrentUser() u: JwtUser, @Body() dto: RecordSaleDto) { return this.counter.recordSale(u.operatorId!, dto); }

  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @RequirePermission('VIEW_COUNTER') @Get(':id/closing')
  closing(@CurrentUser() u: JwtUser, @Param('id') id: string, @Query('date') date?: string) { return this.counter.dailyClosing(u.operatorId!, id, date); }
}
