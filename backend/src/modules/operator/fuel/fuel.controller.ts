import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FuelService } from './fuel.service';
import { FuelCardDto, FuelTxnDto } from './dto/fuel.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator-scoped fuel management endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/fuel')
export class FuelController {
  constructor(private readonly fuel: FuelService) {}

  @RequirePermission('CREATE_FUEL_TXN') @Post('transactions')
  create(@CurrentUser() u: JwtUser, @Body() dto: FuelTxnDto) { return this.fuel.createTransaction(u.operatorId!, dto); }
  @RequirePermission('VIEW_FUEL_REPORTS') @Get('transactions')
  list(@CurrentUser() u: JwtUser) { return this.fuel.listTransactions(u.operatorId!); }
  @RequirePermission('APPROVE_FUEL_TXN') @Patch('transactions/:id/approve')
  approve(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.fuel.approveTransaction(u.operatorId!, id); }

  @RequirePermission('VIEW_FUEL_REPORTS') @Get('buses/:busId/efficiency')
  efficiency(@CurrentUser() u: JwtUser, @Param('busId') busId: string, @Query('benchmark') benchmark?: string) {
    return this.fuel.efficiencyReport(u.operatorId!, busId, Number(benchmark) || 4);
  }

  @RequirePermission('MANAGE_FUEL_CARD') @Post('cards')
  createCard(@CurrentUser() u: JwtUser, @Body() dto: FuelCardDto) { return this.fuel.createCard(u.operatorId!, dto); }
  @RequirePermission('MANAGE_FUEL_CARD') @Get('cards')
  listCards(@CurrentUser() u: JwtUser) { return this.fuel.listCards(u.operatorId!); }
  @RequirePermission('MANAGE_FUEL_CARD') @Patch('cards/:id/suspend')
  suspendCard(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.fuel.setCardStatus(u.operatorId!, id, 'SUSPENDED'); }
}
