import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { PingDto } from './dto/ping.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}
  @Roles(Role.DRIVER, Role.OPERATOR_ADMIN) @Post('ping')
  ping(@CurrentUser() u: JwtUser, @Body() dto: PingDto) { return this.tracking.ping(u.operatorId, u.role, dto); }
  @Public() @Get(':tripId/live') live(@Param('tripId') tripId: string) { return this.tracking.live(tripId); }
}
