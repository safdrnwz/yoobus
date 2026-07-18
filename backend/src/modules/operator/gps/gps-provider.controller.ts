import { Body, Controller, Get, Put } from '@nestjs/common';
import { GpsService } from './gps.service';
import { SetProviderStatusDto } from './dto/gps.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { Role } from '../../../common/enums/role.enum';

/** Platform: the SuperAdmin switches GPS providers on/off for the whole platform. */
@Roles(Role.SUPERADMIN)
@Controller('gps/providers')
export class GpsProviderController {
  constructor(private readonly gps: GpsService) {}

  @RequirePermission('MANAGE_GPS_PROVIDER') @Get()
  list() { return this.gps.listProviders(); }

  @RequirePermission('MANAGE_GPS_PROVIDER') @Put()
  setStatus(@Body() dto: SetProviderStatusDto) { return this.gps.setProviderStatus(dto.providerName, dto.enabled); }
}
