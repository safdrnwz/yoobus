import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BoardingService } from './boarding.service';
import { ManualBoardDto, ScanDto } from './dto/boarding.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Driver/operator boarding & QR validation endpoints. */
@Roles(Role.DRIVER, Role.OPERATOR_ADMIN)
@Controller('booking/boarding')
export class BoardingController {
  constructor(private readonly boarding: BoardingService) {}

  @RequirePermission('VIEW_BOARDING_LIST') @Get('trip/:tripId')
  list(@CurrentUser() u: JwtUser, @Param('tripId') tripId: string) { return this.boarding.boardingList(u.operatorId!, tripId); }

  @RequirePermission('SCAN_QR') @Post('scan')
  scan(@CurrentUser() u: JwtUser, @Body() dto: ScanDto) { return this.boarding.scanAndBoard(u.operatorId!, dto.tripId, dto.qrPayload); }

  @RequirePermission('MARK_BOARDED') @Post('manual')
  manual(@CurrentUser() u: JwtUser, @Body() dto: ManualBoardDto) { return this.boarding.manualBoard(u.operatorId!, dto.tripId, dto.pnr); }

  @RequirePermission('MARK_NO_SHOW') @Post('no-show')
  noShow(@CurrentUser() u: JwtUser, @Body() dto: ManualBoardDto) { return this.boarding.markNoShow(u.operatorId!, dto.tripId, dto.pnr); }
}
