import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DriverComplianceService } from './driver-compliance.service';
import { AddDocumentDto, TrainingDto, ViolationDto } from './dto/compliance.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator-scoped driver compliance endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/driver-compliance')
export class DriverComplianceController {
  constructor(private readonly compliance: DriverComplianceService) {}

  @RequirePermission('UPLOAD_DRIVER_DOCUMENTS') @Post('documents')
  addDocument(@CurrentUser() u: JwtUser, @Body() dto: AddDocumentDto) { return this.compliance.addDocument(u.operatorId!, dto); }
  @RequirePermission('VIEW_DRIVER_COMPLIANCE_DASHBOARD') @Get('drivers/:driverId/documents')
  documents(@CurrentUser() u: JwtUser, @Param('driverId') driverId: string) { return this.compliance.documentsFor(u.operatorId!, driverId); }
  @RequirePermission('VIEW_EXPIRING_DOCS') @Get('expiring')
  expiring(@CurrentUser() u: JwtUser, @Query('warningDays') warningDays?: string) { return this.compliance.expiringDocuments(u.operatorId!, Number(warningDays) || 30); }
  @RequirePermission('VIEW_DRIVER_COMPLIANCE_DASHBOARD') @Get('drivers/:driverId/status')
  status(@CurrentUser() u: JwtUser, @Param('driverId') driverId: string) { return this.compliance.complianceStatus(u.operatorId!, driverId); }

  @RequirePermission('RECORD_DRIVER_VIOLATION') @Post('violations')
  recordViolation(@CurrentUser() u: JwtUser, @Body() dto: ViolationDto) { return this.compliance.recordViolation(u.operatorId!, dto); }
  @RequirePermission('VIEW_DRIVER_COMPLIANCE_DASHBOARD') @Get('drivers/:driverId/violations')
  violations(@CurrentUser() u: JwtUser, @Param('driverId') driverId: string) { return this.compliance.violationsFor(u.operatorId!, driverId); }

  @RequirePermission('ASSIGN_DRIVER_TRAINING') @Post('training')
  recordTraining(@CurrentUser() u: JwtUser, @Body() dto: TrainingDto) { return this.compliance.recordTraining(u.operatorId!, dto); }
  @RequirePermission('VIEW_DRIVER_COMPLIANCE_DASHBOARD') @Get('drivers/:driverId/training')
  training(@CurrentUser() u: JwtUser, @Param('driverId') driverId: string) { return this.compliance.trainingFor(u.operatorId!, driverId); }
}
