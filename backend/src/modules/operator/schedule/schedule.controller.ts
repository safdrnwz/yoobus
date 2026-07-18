import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto, GenerateTripsDto } from './dto/schedule.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { RequirePermission } from '../../../common/rbac/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

/** Operator-scoped trip schedule endpoints. */
@Roles(Role.OPERATOR_ADMIN)
@Controller('operator/schedules')
export class ScheduleController {
  constructor(private readonly schedules: ScheduleService) {}

  @RequirePermission('CREATE_SCHEDULE') @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateScheduleDto) { return this.schedules.create(u.operatorId!, dto); }

  @RequirePermission('VIEW_SCHEDULE') @Get()
  list(@CurrentUser() u: JwtUser) { return this.schedules.listByOperator(u.operatorId!); }

  @RequirePermission('ACTIVATE_SCHEDULE') @Patch(':id/activate')
  activate(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.schedules.setActive(u.operatorId!, id, true); }

  @RequirePermission('ACTIVATE_SCHEDULE') @Patch(':id/suspend')
  suspend(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.schedules.setActive(u.operatorId!, id, false); }

  @RequirePermission('VIEW_SCHEDULE') @Post(':id/preview')
  preview(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: GenerateTripsDto) { return this.schedules.preview(u.operatorId!, id, dto); }

  @RequirePermission('CREATE_TRIP') @Post(':id/generate')
  generate(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: GenerateTripsDto) { return this.schedules.generate(u.operatorId!, id, dto); }
}
