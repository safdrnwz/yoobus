import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from '../../integrations/uploads/uploads.service';
import { AppException } from '../../../common/errors/app-exception';
import { FleetService } from './fleet.service';
import { CloseWorkOrderDto, CreateWorkOrderDto, PartDto, UpdateVehicleDocDto, VehicleDocDto, VerifyVehicleDocDto } from './dto/fleet.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator-scoped fleet maintenance endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/fleet')
export class FleetController {
  constructor(private readonly fleet: FleetService, private readonly uploads: UploadsService) {}

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
  /** Bus Master §16.9 — update a document (dates, status, remarks). */
  @RequirePermission('MANAGE_VEHICLE_DOCS') @Patch('vehicle-documents/:id')
  updateDoc(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateVehicleDocDto) { return this.fleet.updateVehicleDoc(u.operatorId!, id, dto); }
  /** Bus Master §8.F — verify/reject a document, with audit trail. */
  @RequirePermission('MANAGE_VEHICLE_DOCS') @Patch('vehicle-documents/:id/verify')
  verifyDoc(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: VerifyVehicleDocDto) { return this.fleet.verifyVehicleDoc(u.operatorId!, id, u.id, dto); }
  /** Bus Master §16.10 — upload the document FILE (image/PDF) to the CDN and attach it. */
  @RequirePermission('MANAGE_VEHICLE_DOCS') @Post('vehicle-documents/:id/file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocFile(@CurrentUser() u: JwtUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new AppException('NO_FILE', 'Send the file in a multipart field named "file".', HttpStatus.BAD_REQUEST);
    const up = await this.uploads.upload(file, 'bus-documents');
    return this.fleet.attachDocFile(u.operatorId!, id, up.url, up.fileName);
  }
  /** Bus Master §8.F — all documents of one bus, each graded with its expiry alert level. */
  @RequirePermission('MANAGE_VEHICLE_DOCS') @Get('buses/:busId/documents')
  busDocs(@CurrentUser() u: JwtUser, @Param('busId') busId: string) { return this.fleet.listBusDocs(u.operatorId!, busId); }
  /** Bus Master §14.L / §16.14 — overall bus compliance status. */
  @RequirePermission('VIEW_VEHICLE_HEALTH') @Get('buses/:busId/compliance')
  compliance(@CurrentUser() u: JwtUser, @Param('busId') busId: string) { return this.fleet.busCompliance(u.operatorId!, busId); }

  @RequirePermission('MANAGE_PARTS_INVENTORY') @Post('parts')
  upsertPart(@CurrentUser() u: JwtUser, @Body() dto: PartDto) { return this.fleet.upsertPart(u.operatorId!, dto); }
  @RequirePermission('MANAGE_PARTS_INVENTORY') @Get('parts')
  listParts(@CurrentUser() u: JwtUser) { return this.fleet.listParts(u.operatorId!); }
}
