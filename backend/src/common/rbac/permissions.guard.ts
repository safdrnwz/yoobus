import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
import { RbacService } from './rbac.service';
import { Role } from '../enums/role.enum';
import { AppException } from '../errors/app-exception';

/**
 * Declarative permission gate. Activates only on routes annotated with @RequirePermission.
 * Runs after JwtAuthGuard (so req.user is populated) and reads effective permissions from
 * the single-source catalog plus per-operator overrides.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rbac: RbacService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSION_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new AppException('UNAUTHORIZED', 'Authentication is required.', HttpStatus.UNAUTHORIZED);
    // Custom roles are resolved here, on the one path every guarded request already takes.
    // Additive only, and it degrades to the base role if anything at all goes wrong.
    const allowed = await this.rbac.canWithCustomRole(user, required);
    if (!allowed) {
      throw new AppException('PERMISSION_DENIED', `You do not have permission to perform this action. Required: ${required.join(', ')}.`, HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
