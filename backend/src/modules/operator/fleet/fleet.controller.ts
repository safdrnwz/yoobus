import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { CloseWorkOrderDto, CreateWorkOrderDto, PartDto, VehicleDocDto } from './dto/fleet.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator-scoped fleet maintenance endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/fleet')
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @RequirePermission('CREATE_WORK_ORDER') @Post('work-orders')
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateWorkOrderDto) { return this.fleet.createWorkOrder(u.operatorId!, dto); }
  @RequirePermission('VIEW_VEHICLE_HEALTH') @Get('work-orders')
  list(@CurrentUser() u: JwtUser) { return this.fleet.listWorkOrders(u.operatorId!); }
  @RequirePermission('APPROVE_WORK_ORDER') @Patch('work-orders/:id/start')
  start(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.fleet.transitionWorkOrder(u.operatorId!, id, 'IN_PROGRESS'); }
  @RequirePermission('APPROVE_WORK_ORDER') @Patch('work-orders/:id/close')
  close(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CloseWorkOrderDto) { return this.fleet.transitionWorkOrder(u.operatorId!, id, 'CLOSED', dto); }
  @RequirePermission('APPROVE_WORK_ORDER') @Patch('work-orders/:id/cancel')
  cancel(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.fleet.transitionWorkOrder(u.operatorId!, id, 'CANCELLED'); }

  @RequirePermission('MANAGE_VEHICLE_DOCS') @Post('vehicle-documents')
  addDoc(@CurrentUser() u: JwtUser, @Body() dto: VehicleDocDto) { return this.fleet.addVehicleDoc(u.operatorId!, dto); }
  @RequirePermission('MANAGE_VEHICLE_DOCS') @Get('vehicle-documents/expiring')
  expiringDocs(@CurrentUser() u: JwtUser, @Query('warningDays') warningDays?: string) { return this.fleet.expiringVehicleDocs(u.operatorId!, Number(warningDays) || 30); }

  @RequirePermission('MANAGE_PARTS_INVENTORY') @Post('parts')
  upsertPart(@CurrentUser() u: JwtUser, @Body() dto: PartDto) { return this.fleet.upsertPart(u.operatorId!, dto); }
  @RequirePermission('MANAGE_PARTS_INVENTORY') @Get('parts')
  listParts(@CurrentUser() u: JwtUser) { return this.fleet.listParts(u.operatorId!); }
}
