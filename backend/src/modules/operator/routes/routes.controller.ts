import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto , UpdateRouteDto} from './dto/create-route.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}
  @Roles(Role.OPERATOR_ADMIN) @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateRouteDto) { return this.routes.create(u.operatorId!, dto); }
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @Get() list(@CurrentUser() u: JwtUser) { return this.routes.listByOperator(u.operatorId!); }
  @Roles(Role.OPERATOR_ADMIN, Role.SUPPORT) @Get(':id') get(@Param('id') id: string) { return this.routes.findById(id); }

  @Roles(Role.OPERATOR_ADMIN) @Patch(':id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() patch: UpdateRouteDto) { return this.routes.update(u.operatorId!, id, patch); }

  @Roles(Role.OPERATOR_ADMIN) @Delete(':id')
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.routes.softDelete(u.role, u.operatorId!, id); }
}
