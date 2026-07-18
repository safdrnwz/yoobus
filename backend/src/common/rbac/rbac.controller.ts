import { IsBoolean, IsEnum, IsString } from 'class-validator';
import { Body, Controller, Delete, Get, HttpStatus, Post, Query } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { CurrentUser, JwtUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { Role, OPERATOR_CREATABLE_ROLES } from '../enums/role.enum';
import { PERMISSION_CATALOG } from './permission-catalog';
import { AppException } from '../errors/app-exception';

/** RBAC catalog viewing and per-operator permission override management. */
/** Privilege escalation surface — it must be validated. */
export class SetOverrideDto {
  @IsEnum(Role) role: Role;
  @IsString() permissionKey: string;
  @IsBoolean() granted: boolean;
}

/**
 * The DELETE variant took `role` and `permissionKey` as raw @Query strings. Calling it
 * without them handed `undefined` to assertManageable(), which answered 403 FORBIDDEN —
 * telling the caller they lacked permission when in fact they had simply forgotten an
 * argument. A missing argument is a 400.
 */
export class ClearOverrideQueryDto {
  @IsEnum(Role) role: Role;
  @IsString() permissionKey: string;
}

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  /** The full permission catalog, grouped. Visible to admins for clarity. */
  @Roles(Role.SUPERADMIN, Role.OPERATOR_ADMIN)
  @Get('catalog')
  catalog() {
    const grouped: Record<string, { key: string; label: string; roles: Role[] }[]> = {};
    for (const p of PERMISSION_CATALOG) {
      grouped[p.group] = grouped[p.group] ?? [];
      grouped[p.group].push({ key: p.key, label: p.label, roles: p.roles });
    }
    return grouped;
  }

  /** The current user's effective permissions (role defaults + operator overrides). */
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.rbac.effectivePermissions(user.role as Role, user.operatorId ?? null);
  }

  /** Overrides configured by this operator. */
  @Roles(Role.OPERATOR_ADMIN)
  @Get('overrides')
  overrides(@CurrentUser() user: JwtUser) {
    return this.rbac.listOverrides(user.operatorId!);
  }

  /**
   * Grant or revoke one permission for one of this operator's staff roles. The operator
   * can only touch their own operator, only staff roles they manage, and only operator-domain
   * permissions (platform powers can never be granted from here).
   */
  @Roles(Role.OPERATOR_ADMIN)
  @Post('overrides')
  setOverride(@CurrentUser() user: JwtUser, @Body() body: SetOverrideDto) {
    this.assertManageable(body.role, body.permissionKey);
    return this.rbac.setOverride(user.operatorId!, body.role, body.permissionKey, body.granted);
  }

  @Roles(Role.OPERATOR_ADMIN)
  @Delete('overrides')
  clearOverride(@CurrentUser() user: JwtUser, @Query() q: ClearOverrideQueryDto) {
    this.assertManageable(q.role, q.permissionKey);
    return this.rbac.clearOverride(user.operatorId!, q.role, q.permissionKey);
  }

  private assertManageable(role: Role, permissionKey: string): void {
    if (!OPERATOR_CREATABLE_ROLES.includes(role)) {
      throw new AppException('ROLE_NOT_MANAGEABLE', 'You can only adjust permissions for your own staff roles.', HttpStatus.FORBIDDEN);
    }
    const def = PERMISSION_CATALOG.find((p) => p.key === permissionKey);
    if (!def) throw new AppException('PERMISSION_UNKNOWN', 'Unknown permission.', HttpStatus.BAD_REQUEST);
    if (def.group.startsWith('PLATFORM_')) {
      throw new AppException('PERMISSION_NOT_GRANTABLE', 'Platform permissions cannot be granted by an operator.', HttpStatus.FORBIDDEN);
    }
  }
}
