import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { AssignBusDto , UpdateDriverDto} from './dto/assign-bus.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';

@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}
  @Roles(Role.OPERATOR_ADMIN) @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateDriverDto) { return this.drivers.create(u.operatorId!, dto); }
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @Get()
  list(@CurrentUser() u: JwtUser) { return this.drivers.listByOperator(u.operatorId!); }
  @Roles(Role.OPERATOR_ADMIN) @Patch(':id/assign')
  assign(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: AssignBusDto) { return this.drivers.assignBus(u.operatorId!, id, dto.busId); }
  @Roles(Role.OPERATOR_ADMIN) @Patch(':id/unassign')
  unassign(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.drivers.unassignBus(u.operatorId!, id); }

  @Roles(Role.OPERATOR_ADMIN) @Patch(':id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() patch: UpdateDriverDto) { return this.drivers.update(u.operatorId!, id, patch); }

  @Roles(Role.OPERATOR_ADMIN) @Delete(':id')
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.drivers.softDelete(u.role, u.operatorId!, id); }
}
