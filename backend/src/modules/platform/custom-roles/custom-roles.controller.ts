import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { AssignCustomRoleDto, CreateCustomRoleDto, UpdateCustomRoleDto } from './dto/custom-role.dto';
import { CustomRolesService } from './custom-roles.service';

/**
 * IAM — the roles an OPERATOR invents.
 *
 * Enterprise only, capped at five, and every one of them is built from the same permission
 * catalogue everything else uses. An operator cannot grant what an operator admin does not
 * already hold: the ceiling is their own authority, enforced on the server, on every request.
 *
 * OPERATOR_ADMIN only, deliberately. Letting a custom role hold "manage custom roles" is how
 * someone quietly writes themselves a new role with more power than the one they were given.
 */
@Roles(Role.OPERATOR_ADMIN)
@Controller('custom-roles')
export class CustomRolesController {
  constructor(private readonly roles: CustomRolesService) {}

  /** Exactly the permissions this operator may build a role out of. Never a checkbox that fails. */
  @Get('grantable')
  grantable() {
    return this.roles.grantablePermissions();
  }

  /** Includes switched-off roles: a downgraded operator's roles are not gone, only inactive. */
  @Get()
  list(@CurrentUser() u: JwtUser) {
    return this.roles.list(u.operatorId!);
  }

  @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateCustomRoleDto) {
    return this.roles.create(u.operatorId!, u.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateCustomRoleDto) {
    return this.roles.update(u.operatorId!, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.roles.remove(u.operatorId!, id);
  }

  /** Put someone on a role, or take them off it. Their base role is never replaced. */
  @Post('assign')
  assign(@CurrentUser() u: JwtUser, @Body() dto: AssignCustomRoleDto) {
    return this.roles.assign(u.operatorId!, dto.userId, dto.roleId ?? null);
  }
}
