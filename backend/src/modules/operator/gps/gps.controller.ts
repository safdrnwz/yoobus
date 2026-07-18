import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { GpsService } from './gps.service';
import { MapDeviceDto, SaveGpsConfigDto } from './dto/gps.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator: configure the GPS integration, map buses to devices, and issue tracking links. */
@Roles(Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER)
@Controller('gps')
export class GpsController {
  constructor(private readonly gps: GpsService) {}

  @RequirePermission('CONFIGURE_GPS') @Get('config')
  getConfig(@CurrentUser() u: JwtUser) { return this.gps.getConfig(u.operatorId!); }

  @RequirePermission('CONFIGURE_GPS') @Put('config')
  saveConfig(@CurrentUser() u: JwtUser, @Body() dto: SaveGpsConfigDto) { return this.gps.saveConfig(u.operatorId!, dto); }

  @RequirePermission('CONFIGURE_GPS') @Post('config/test')
  test(@CurrentUser() u: JwtUser) { return this.gps.testConnection(u.operatorId!); }

  @RequirePermission('MAP_GPS_DEVICE') @Get('devices')
  devices(@CurrentUser() u: JwtUser) { return this.gps.listDevices(u.operatorId!); }

  @RequirePermission('MAP_GPS_DEVICE') @Post('devices')
  map(@CurrentUser() u: JwtUser, @Body() dto: MapDeviceDto) { return this.gps.mapDevice(u.operatorId!, dto); }

  @RequirePermission('MAP_GPS_DEVICE') @Delete('devices/:id')
  unmap(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.gps.unmapDevice(u.operatorId!, id); }

  // Issue (or fetch) the one tracking link for a booking.
  @RequirePermission('VIEW_LIVE_TRACKING') @Post('tracking/:bookingId')
  track(@CurrentUser() u: JwtUser, @Param('bookingId') bookingId: string) {
    return this.gps.createTrackingForBooking(u.operatorId!, bookingId);
  }
}
