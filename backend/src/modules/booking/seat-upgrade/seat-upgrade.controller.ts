import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SeatUpgradeService } from './seat-upgrade.service';
import { OfferUpgradeDto } from './dto/upgrade.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator-scoped seat-upgrade endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('booking/seat-upgrade')
export class SeatUpgradeController {
  constructor(private readonly upgrade: SeatUpgradeService) {}

  @RequirePermission('OFFER_SEAT_UPGRADE') @Post('offers')
  offer(@CurrentUser() u: JwtUser, @Body() dto: OfferUpgradeDto) { return this.upgrade.offer(u.operatorId!, dto); }
  @RequirePermission('APPROVE_SEAT_UPGRADE') @Patch('offers/:id/apply')
  apply(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.upgrade.apply(u.operatorId!, id); }
  @RequirePermission('APPROVE_SEAT_UPGRADE') @Patch('offers/:id/reject')
  reject(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.upgrade.reject(u.operatorId!, id); }
  @RequirePermission('VIEW_UPGRADE_REPORTS') @Get('bookings/:bookingId/offers')
  list(@CurrentUser() u: JwtUser, @Param('bookingId') bookingId: string) { return this.upgrade.listForBooking(u.operatorId!, bookingId); }
}
