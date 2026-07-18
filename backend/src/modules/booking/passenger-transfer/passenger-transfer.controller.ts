import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PassengerTransferService } from './passenger-transfer.service';
import { InitiateTransferDto } from './dto/transfer.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator-scoped passenger transfer / bus exchange endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('booking/transfer')
export class PassengerTransferController {
  constructor(private readonly transfer: PassengerTransferService) {}

  @RequirePermission('INITIATE_PASSENGER_TRANSFER') @Post()
  initiate(@CurrentUser() u: JwtUser, @Body() dto: InitiateTransferDto) { return this.transfer.initiate(u.operatorId!, dto); }
  @RequirePermission('APPROVE_PASSENGER_TRANSFER') @Patch(':id/approve')
  approve(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.transfer.approve(u.operatorId!, id); }
  @RequirePermission('REGENERATE_TICKET') @Patch(':id/execute')
  execute(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.transfer.execute(u.operatorId!, id); }
  @RequirePermission('INITIATE_PASSENGER_TRANSFER') @Patch(':id/cancel')
  cancel(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.transfer.cancel(u.operatorId!, id); }
  @RequirePermission('VIEW_TRANSFER_REPORTS') @Get('bookings/:bookingId')
  list(@CurrentUser() u: JwtUser, @Param('bookingId') bookingId: string) { return this.transfer.listForBooking(u.operatorId!, bookingId); }
}
