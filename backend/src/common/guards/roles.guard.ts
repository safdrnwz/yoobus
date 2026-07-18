import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { AppException } from '../errors/app-exception';
import { HttpStatus } from '@nestjs/common';
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new AppException('UNAUTHORIZED', 'Authentication is required', HttpStatus.UNAUTHORIZED);
    if (!required.includes(user.role))
      throw new AppException('FORBIDDEN', `Access denied. Required role: ${required.join(', ')}`, HttpStatus.FORBIDDEN);
    return true;
  }
}
