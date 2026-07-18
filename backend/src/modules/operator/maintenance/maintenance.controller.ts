import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  // Banner/pop-up source for every authenticated user (operator UI polls this).
  @Get('current')
  current() {
    return this.maintenance.current();
  }

  @Roles(Role.SUPERADMIN) @Get()
  list() {
    return this.maintenance.list();
  }

  @Roles(Role.SUPERADMIN) @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateMaintenanceDto) {
    return this.maintenance.create(u.id, dto);
  }

  @Roles(Role.SUPERADMIN) @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.maintenance.cancel(id);
  }
}
