import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { HubService } from './hub.service';
import { AttachRouteDto, CreateHubDto } from './dto/hub.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator hub-and-spoke endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/hubs')
export class HubController {
  constructor(private readonly hubs: HubService) {}

  @RequirePermission('MANAGE_HUB') @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateHubDto) { return this.hubs.createHub(u.operatorId!, dto); }
  @RequirePermission('VIEW_HUB') @Get()
  list(@CurrentUser() u: JwtUser) { return this.hubs.listHubs(u.operatorId!); }
  @RequirePermission('MANAGE_HUB_ROUTE') @Post(':hubId/routes')
  attach(@CurrentUser() u: JwtUser, @Param('hubId') hubId: string, @Body() dto: AttachRouteDto) { return this.hubs.attachRoute(u.operatorId!, hubId, dto); }
  @RequirePermission('VIEW_HUB') @Get(':hubId/routes')
  spokes(@CurrentUser() u: JwtUser, @Param('hubId') hubId: string) { return this.hubs.listSpokes(u.operatorId!, hubId); }
  @RequirePermission('MANAGE_HUB_ROUTE') @Delete('routes/:id')
  detach(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.hubs.detachRoute(u.operatorId!, id); }
}
