import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { DisruptionService } from './disruption.service';
import { BackupDto, DeclareDisruptionDto, DivertDto, RcaDto } from './dto/disruption.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator control-tower (disruption) endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/disruption')
export class DisruptionController {
  constructor(private readonly disruption: DisruptionService) {}

  @RequirePermission('CREATE_DISRUPTION') @Post()
  declare(@CurrentUser() u: JwtUser, @Body() dto: DeclareDisruptionDto) { return this.disruption.declare(u.operatorId!, dto); }
  @RequirePermission('VIEW_DISRUPTION_DASHBOARD') @Get()
  list(@CurrentUser() u: JwtUser) { return this.disruption.list(u.operatorId!); }
  @RequirePermission('DIVERT_ROUTE') @Patch(':id/divert')
  divert(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: DivertDto) { return this.disruption.divert(u.operatorId!, id, dto); }
  @RequirePermission('DEPLOY_BACKUP') @Patch(':id/backup')
  backup(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: BackupDto) { return this.disruption.deployBackup(u.operatorId!, id, dto); }
  @RequirePermission('CLOSE_DISRUPTION') @Patch(':id/resolve')
  resolve(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.disruption.resolve(u.operatorId!, id); }
  @RequirePermission('CLOSE_DISRUPTION') @Patch(':id/close')
  close(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.disruption.close(u.operatorId!, id); }
  @RequirePermission('RECORD_RCA') @Patch(':id/rca')
  rca(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: RcaDto) { return this.disruption.recordRca(u.operatorId!, id, dto); }
}
